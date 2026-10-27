import 'server-only';

import { getTableName, sql } from 'drizzle-orm';

import { media } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { FAVICON_FILES, faviconKey } from '@/core/media/favicon';
import type { StorageAdapter } from '@/core/storage/types';

import { COPY_TABLES, copyTables } from './copy';

/**
 * `db:clone`: replaces the target database's content with the source's (staging
 * refreshed from production). Same tables as the Connect Supabase copy (users,
 * settings, content, media rows, requests; no sessions, analytics or audit log).
 * The target is migrated by the caller first. Integration secrets come along
 * encrypted with the source's AUTH_SECRET, so the target shows "Re-enter the key".
 */
export async function cloneDatabase(from: Database, to: Database): Promise<Record<string, number>> {
  const tables = COPY_TABLES.map((table) => `"${getTableName(table)}"`).join(', ');
  await to.execute(sql.raw(`TRUNCATE ${tables} CASCADE`));
  return copyTables(from, to);
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
