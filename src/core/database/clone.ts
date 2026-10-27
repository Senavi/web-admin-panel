import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { getTableName, sql } from 'drizzle-orm';

import { executeRows } from '@/core/db/execute';
import { MIGRATIONS_DIR } from '@/core/db/paths';
import {
  collectionItems,
  databaseEnvironment,
  formSubmissions,
  media,
  pageContent,
  settings,
  users,
} from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { DeploymentEnvironment } from '@/core/deployment/environment';
import { FAVICON_FILES, faviconKey } from '@/core/media/favicon';
import type { StorageAdapter } from '@/core/storage/types';

import type { CloneDatabaseState } from './clone-guard';
import { COPY_TABLES, copyTables } from './copy';
import { markDatabaseEnvironment, readDatabaseMarker } from './environment-marker';
import type { RemoteContentSummary } from './remote-summary';

/** Tables counted for the confirmation and the "is it empty" checks. */
const SUMMARY_TABLES = {
  users: getTableName(users),
  contentRows: getTableName(pageContent),
  items: getTableName(collectionItems),
  images: getTableName(media),
  submissions: getTableName(formSubmissions),
} as const satisfies Record<keyof RemoteContentSummary, string>;

const MIGRATIONS_TABLE = 'drizzle.__drizzle_migrations';

async function tableExists(db: Database, name: string): Promise<boolean> {
  const [row] = await executeRows<{ found: string | null }>(
    db,
    sql`select to_regclass(${name})::text as found`,
  );
  return Boolean(row?.found);
}

async function countRows(db: Database, table: string): Promise<number> {
  if (!(await tableExists(db, `public.${table}`))) return 0;
  const [row] = await executeRows<{ total: number }>(
    db,
    sql`select count(*)::int as total from ${sql.identifier(table)}`,
  );
  return Number(row?.total ?? 0);
}

/** What a database holds (tables that don't exist yet count as 0). Read-only. */
export async function contentSummary(db: Database): Promise<RemoteContentSummary> {
  const summary = {} as Record<keyof RemoteContentSummary, number>;
  for (const key of Object.keys(SUMMARY_TABLES) as Array<keyof RemoteContentSummary>) {
    summary[key] = await countRows(db, SUMMARY_TABLES[key]);
  }
  return summary;
}

/** Number of migrations of this code (the source must have all of them). */
export function expectedMigrations(): number {
  const journal = JSON.parse(
    readFileSync(path.join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: unknown[] };
  return journal.entries.length;
}

/**
 * Read-only look at a database before `db:clone` (D-098): marker, migrations,
 * tables, settings row and what it holds. Works on a database that isn't migrated.
 */
export async function inspectCloneDatabase(db: Database): Promise<CloneDatabaseState> {
  const marker = (await tableExists(db, `public.${getTableName(databaseEnvironment)}`))
    ? ((await readDatabaseMarker(db))?.environment ?? null)
    : null;
  const migrations = (await tableExists(db, MIGRATIONS_TABLE))
    ? Number(
        (
          await executeRows<{ total: number }>(
            db,
            sql.raw(`select count(*)::int as total from ${MIGRATIONS_TABLE}`),
          )
        )[0]?.total ?? 0,
      )
    : 0;
  const missingTables: string[] = [];
  for (const table of COPY_TABLES) {
    const name = getTableName(table);
    if (!(await tableExists(db, `public.${name}`))) missingTables.push(name);
  }
  return {
    marker,
    migrations,
    missingTables,
    hasSettings: (await countRows(db, getTableName(settings))) > 0,
    summary: await contentSummary(db),
  };
}

/**
 * `db:clone`: replaces the target database's content with the source's (staging
 * refreshed from production). Same tables as the Connect Supabase copy (users,
 * settings, content, media rows, requests; no sessions, analytics, audit log or
 * environment marker). The caller inspects both databases and migrates the target
 * first. Truncate and copy run in ONE transaction on the target: any failure rolls
 * back and leaves it as it was. The target's marker is re-checked inside the
 * transaction and set to staging. Integration secrets come along encrypted with
 * the source's AUTH_SECRET, so the target shows "Re-enter the key".
 */
export async function cloneDatabase(
  from: Database,
  to: Database,
  options: {
    /** `databaseIdentity()` of the target, recorded with its staging marker. */
    readonly targetIdentity: string | null;
    /** Tests inject a failing copy. */
    readonly copy?: (from: Database, to: Database) => Promise<Record<string, number>>;
  },
): Promise<Record<string, number>> {
  const copy = options.copy ?? copyTables;
  const tables = COPY_TABLES.map((table) => `"${getTableName(table)}"`).join(', ');
  return to.transaction(async (tx) => {
    const marker = await readDatabaseMarker(tx);
    if (marker?.environment === DeploymentEnvironment.Production)
      throw new Error("This is the live site's database (marked production). Nothing was changed.");
    await tx.execute(sql.raw(`TRUNCATE ${tables} CASCADE`));
    const rows = await copy(from, tx);
    await markDatabaseEnvironment(tx, DeploymentEnvironment.Staging, options.targetIdentity);
    return rows;
  });
}

/** Every storage key a media row uses (favicons have derived files). */
export function mediaKeys(row: { storageKey: string; kind: string; id: string }): string[] {
  return [
    row.storageKey,
    ...(row.kind === 'favicon'
      ? [...Object.keys(FAVICON_FILES), 'favicon.ico'].map((file) =>
          faviconKey(row.id, file as keyof typeof FAVICON_FILES),
        )
      : []),
  ];
}

/**
 * Copies the files of every media row of `db` from a public base URL (the
 * source bucket, read only) into `target`. Missing files are skipped.
 */
export async function copyMediaFromUrl(
  db: Database,
  sourceBaseUrl: string,
  target: StorageAdapter,
  fetchImpl: typeof fetch = fetch,
): Promise<{ copied: number; missing: number }> {
  const base = sourceBaseUrl.replace(/\/$/, '');
  let copied = 0;
  let missing = 0;
  for (const row of await db.select().from(media)) {
    for (const key of mediaKeys(row)) {
      const response = await fetchImpl(`${base}/${key}`);
      if (!response.ok) {
        missing += 1;
        continue;
      }
      await target.put(
        key,
        new Uint8Array(await response.arrayBuffer()),
        response.headers.get('content-type') ?? row.mime,
      );
      copied += 1;
    }
  }
  return { copied, missing };
}

/** Copies the files of every media row of `db` from one storage to another; returns files copied. */
export async function copyMediaFiles(
  db: Database,
  source: StorageAdapter,
  target: StorageAdapter,
): Promise<number> {
  let files = 0;
  for (const row of await db.select().from(media)) {
    for (const key of mediaKeys(row)) {
      const file = await source.get(key);
      if (!file) continue;
      await target.put(key, file.body, file.contentType);
      files += 1;
    }
  }
  return files;
}
