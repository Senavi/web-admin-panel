import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { getTableName, sql } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '@/core/db/client';
import { migratePostgres, openPostgres, openSession } from '@/core/db/drivers/postgres';
import { collectionItems, formSubmissions, media, pageContent, users } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { createLocalStorage } from '@/core/storage/local';
import { createSupabaseStorage } from '@/core/storage/supabase';

import { connectionErrorHint, deriveSupabaseUrl, migrationUrl } from '@/core/db/connection-info';

import { copyMediaFiles } from './clone';
import { appTableNames, copyTables } from './copy';
import type { RemoteContentSummary } from './remote-summary';

const postgresUrl = z
  .string()
  .trim()
  .regex(/^postgres(ql)?:\/\//, 'Use a postgres:// connection string.');

/**
 * The Connect dialog's input: one connection string (any Supabase type) and the
 * service role key. The project URL and the migration URL are derived (D-086).
 */
export const supabaseConnectionSchema = z
  .object({
    /** Optional: only used to double-check the project URL. */
    anonKey: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || undefined)
      .pipe(z.string().min(20, 'Paste the anon (public) key or leave it empty.').optional()),
    serviceRoleKey: z.string().trim().min(20, 'Paste the service_role key.'),
    databaseUrl: postgresUrl.refine((url) => deriveSupabaseUrl(url) !== null, {
      message:
        'Paste the connection string from Supabase → Connect (it contains pooler.supabase.com or db.<project>.supabase.co).',
    }),
    bucket: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'Lowercase letters, numbers and dashes.')
      .default('media'),
  })
  .transform((input) => ({
    ...input,
    supabaseUrl: deriveSupabaseUrl(input.databaseUrl) ?? '',
    /** Migrations, data copy and RLS: session mode / direct (see `migrationUrl`). */
    directUrl: migrationUrl({ DATABASE_URL: input.databaseUrl }) ?? input.databaseUrl,
  }));
export type SupabaseConnection = z.output<typeof supabaseConnectionSchema>;

export interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly message: string;
}

/** `select version()` over one connection (TLS for Neon), as a check line. */
export async function checkPostgres(name: string, url: string): Promise<CheckResult> {
  const client = openSession(url);
  try {
    const [row] = await client<{ version: string }[]>`select version()`;
    return {
      name,
      ok: true,
      message: row?.version.split(' ').slice(0, 2).join(' ') ?? 'Connected',
    };
  } catch (error) {
    return {
      name,
      ok: false,
      message:
        connectionErrorHint(error, url) ??
        (error instanceof Error ? error.message : 'Connection failed'),
    };
  } finally {
    await client.end({ timeout: 2 }).catch(() => undefined);
  }
}

/** Step 2: verify every credential before touching anything. */
export async function testSupabaseConnection(input: SupabaseConnection): Promise<CheckResult[]> {
  const storage = createClient(input.supabaseUrl, input.serviceRoleKey, {
    auth: { persistSession: false },
  });
  const [pooled, direct, buckets, anon] = await Promise.all([
    checkPostgres('Database', input.databaseUrl),
    input.directUrl === input.databaseUrl
      ? Promise.resolve(null)
      : checkPostgres('Database (migrations, session mode)', input.directUrl),
    storage.storage.listBuckets(),
    input.anonKey
      ? fetch(`${input.supabaseUrl.replace(/\/$/, '')}/auth/v1/settings`, {
          headers: { apikey: input.anonKey },
        }).catch(() => null)
      : Promise.resolve(undefined),
  ]);
  return [
    pooled,
    ...(direct ? [direct] : []),
    buckets.error
      ? { name: 'Storage (service role)', ok: false, message: buckets.error.message }
      : { name: 'Storage (service role)', ok: true, message: `${buckets.data.length} bucket(s)` },
    ...(anon === undefined
      ? []
      : [
          anon?.ok
            ? { name: 'Anon key', ok: true, message: 'Accepted' }
            : {
                name: 'Anon key',
                ok: false,
                message: anon ? `Rejected (${anon.status})` : 'Project URL unreachable',
              },
        ]),
  ];
}

/** Step 3: apply the committed migrations through the direct connection. */
export async function migrateSupabase(input: SupabaseConnection): Promise<void> {
  await migratePostgres(input.directUrl);
}

const SUMMARY_TABLES = {
  users: getTableName(users),
  contentRows: getTableName(pageContent),
  items: getTableName(collectionItems),
  images: getTableName(media),
  submissions: getTableName(formSubmissions),
} as const satisfies Record<keyof RemoteContentSummary, string>;

/**
 * Counts what the target already holds, before "Copy my local content" (tables
 * that don't exist yet count as 0). Read-only.
 */
export async function remoteContentSummary(
  input: Pick<SupabaseConnection, 'directUrl'>,
): Promise<RemoteContentSummary> {
  const client = openSession(input.directUrl);
  try {
    const counts: Record<keyof RemoteContentSummary, number> = {
      users: 0,
      contentRows: 0,
      items: 0,
      images: 0,
      submissions: 0,
    };
    for (const key of Object.keys(SUMMARY_TABLES) as Array<keyof RemoteContentSummary>) {
      const table = SUMMARY_TABLES[key];
      const [exists] = await client<
        Array<{ found: string | null }>
      >`select to_regclass(${`public.${table}`})::text as found`;
      if (!exists?.found) continue;
      const [row] = await client<
        Array<{ total: number }>
      >`select count(*)::int as total from ${client(table)}`;
      counts[key] = row?.total ?? 0;
    }
    return counts;
  } finally {
    await client.end({ timeout: 5 });
  }
}

/** Step 4: copy local data and uploaded files. */
export async function migrateDataToSupabase(
  input: SupabaseConnection,
): Promise<{ rows: Record<string, number>; files: number }> {
  const local = await getDb();
  const remote = openPostgres(input.directUrl, { max: 1 });
  try {
    const rows = await copyTables(local, remote.db);
    await ensureBucket(input);
    const files = await copyMediaFiles(
      local,
      createLocalStorage(),
      createSupabaseStorage({
        url: input.supabaseUrl,
        serviceRoleKey: input.serviceRoleKey,
        bucket: input.bucket,
      }),
    );
    return { rows, files };
  } finally {
    await remote.close();
  }
}

async function ensureBucket(input: SupabaseConnection): Promise<void> {
  await ensureStorageBucket(input);
}

/** Creates the public-read media bucket if missing (writes need the service role key). */
export async function ensureStorageBucket(input: {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
  readonly bucket: string;
}): Promise<void> {
  const client = createClient(input.supabaseUrl, input.serviceRoleKey, {
    auth: { persistSession: false },
  });
  const existing = await client.storage.getBucket(input.bucket);
  if (existing.data) {
    if (!existing.data.public) await client.storage.updateBucket(input.bucket, { public: true });
    return;
  }
  const created = await client.storage.createBucket(input.bucket, {
    public: true,
    fileSizeLimit: '10MB',
  });
  if (created.error)
    throw new Error(`Could not create the storage bucket: ${created.error.message}`);
}

/**
 * Row Level Security on every app table with NO policies: the app connects
 * server-side as the owner, so the public Data API exposes nothing. Idempotent.
 */
export async function enableRowLevelSecurity(db: Database): Promise<string[]> {
  const tables = appTableNames();
  for (const table of tables) {
    await db.execute(
      sql.raw(
        `alter table if exists "public"."${table.replace(/"/g, '')}" enable row level security`,
      ),
    );
  }
  return tables;
}

/**
 * Step 5: Row Level Security on every app table with NO policies (the app
 * connects server-side; the public Data API exposes nothing) and a public-read
 * bucket (writes need the service role key).
 */
export async function secureSupabase(input: SupabaseConnection): Promise<{ tables: string[] }> {
  const remote = openPostgres(input.directUrl, { max: 1 });
  try {
    const tables = await enableRowLevelSecurity(remote.db);
    await ensureBucket(input);
    return { tables };
  } finally {
    await remote.close();
  }
}

export const ENV_LOCAL_FILE = path.join(/*turbopackIgnore: true*/ process.cwd(), '.env.local');

/** Step 6: write the variables to .env.local (gitignored). Existing other variables are kept. */
export function writeEnvLocal(input: SupabaseConnection): string[] {
  const values: Record<string, string> = {
    DATABASE_URL: input.databaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: input.serviceRoleKey,
    ...(input.anonKey ? { SUPABASE_ANON_KEY: input.anonKey } : {}),
  };
  // Older Connect runs wrote these; they are derived now and would only go stale.
  const replaced = [
    ...Object.keys(values),
    'SUPABASE_ANON_KEY',
    'DIRECT_URL',
    'SUPABASE_URL',
    'STORAGE_DRIVER',
    'SUPABASE_STORAGE_BUCKET',
  ];
  const existing = fs.existsSync(ENV_LOCAL_FILE)
    ? fs.readFileSync(ENV_LOCAL_FILE, 'utf8').split('\n')
    : [];
  const kept = existing.filter((line) => !replaced.some((key) => line.startsWith(`${key}=`)));
  const lines = [
    ...kept.filter((line, i) => line.trim() !== '' || i < kept.length - 1),
    '# Added by Connect Supabase (Security page)',
    ...Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`),
    '',
  ];
  fs.writeFileSync(ENV_LOCAL_FILE, lines.join('\n'), { mode: 0o600 });
  return Object.keys(values);
}
