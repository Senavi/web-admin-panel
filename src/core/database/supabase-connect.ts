import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { z } from 'zod';

import { getDb } from '@/core/db/client';
import { migratePostgres, openPostgres } from '@/core/db/drivers/postgres';
import { media } from '@/core/db/schema';
import { FAVICON_FILES, faviconKey } from '@/core/media/favicon';
import { createLocalStorage } from '@/core/storage/local';
import { createSupabaseStorage } from '@/core/storage/supabase';

import { appTableNames, copyTables } from './copy';

const postgresUrl = z
  .string()
  .trim()
  .regex(/^postgres(ql)?:\/\//, 'Use a postgres:// connection string.');

export const supabaseConnectionSchema = z.object({
  supabaseUrl: z.url('Enter the project URL, e.g. https://xyz.supabase.co').trim(),
  anonKey: z.string().trim().min(20, 'Paste the anon (public) key.'),
  serviceRoleKey: z.string().trim().min(20, 'Paste the service_role key.'),
  databaseUrl: postgresUrl,
  directUrl: postgresUrl,
  bucket: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'Lowercase letters, numbers and dashes.')
    .default('media'),
});
export type SupabaseConnection = z.output<typeof supabaseConnectionSchema>;

export interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly message: string;
}

async function checkPostgres(name: string, url: string): Promise<CheckResult> {
  const client = postgres(url, {
    prepare: false,
    max: 1,
    connect_timeout: 10,
    onnotice: () => undefined,
  });
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
      message: error instanceof Error ? error.message : 'Connection failed',
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
    checkPostgres('Database (pooled)', input.databaseUrl),
    checkPostgres('Database (direct)', input.directUrl),
    storage.storage.listBuckets(),
    fetch(`${input.supabaseUrl.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: input.anonKey },
    }).catch(() => null),
  ]);
  return [
    pooled,
    direct,
    buckets.error
      ? { name: 'Storage (service role)', ok: false, message: buckets.error.message }
      : { name: 'Storage (service role)', ok: true, message: `${buckets.data.length} bucket(s)` },
    anon?.ok
      ? { name: 'Anon key', ok: true, message: 'Accepted' }
      : {
          name: 'Anon key',
          ok: false,
          message: anon ? `Rejected (${anon.status})` : 'Project URL unreachable',
        },
  ];
}

/** Step 3: apply the committed migrations through the direct connection. */
export async function migrateSupabase(input: SupabaseConnection): Promise<void> {
  await migratePostgres(input.directUrl);
}

/** Step 4: copy local data and uploaded files. */
export async function migrateDataToSupabase(
  input: SupabaseConnection,
): Promise<{ rows: Record<string, number>; files: number }> {
  const local = await getDb();
  const remote = openPostgres(input.directUrl, { max: 1 });
  try {
    const rows = await copyTables(local, remote.db);
    const source = createLocalStorage();
    const target = createSupabaseStorage({
      url: input.supabaseUrl,
      serviceRoleKey: input.serviceRoleKey,
      bucket: input.bucket,
    });
    await ensureBucket(input);
    let files = 0;
    for (const item of await local.select().from(media)) {
      const keys = [
        item.storageKey,
        ...(item.kind === 'favicon'
          ? [...Object.keys(FAVICON_FILES), 'favicon.ico'].map((file) =>
              faviconKey(item.id, file as keyof typeof FAVICON_FILES),
            )
          : []),
      ];
      for (const key of keys) {
        const file = await source.get(key);
        if (!file) continue;
        await target.put(key, file.body, file.contentType);
        files += 1;
      }
    }
    return { rows, files };
  } finally {
    await remote.close();
  }
}

async function ensureBucket(input: SupabaseConnection): Promise<void> {
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
 * Step 5: Row Level Security on every app table with NO policies (the app
 * connects server-side; the public Data API exposes nothing) and a public-read
 * bucket (writes need the service role key).
 */
export async function secureSupabase(input: SupabaseConnection): Promise<{ tables: string[] }> {
  const remote = openPostgres(input.directUrl, { max: 1 });
  try {
    const tables = appTableNames();
    for (const table of tables) {
      await remote.db.execute(
        sql.raw(
          `alter table if exists "public"."${table.replace(/"/g, '')}" enable row level security`,
        ),
      );
    }
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
    DIRECT_URL: input.directUrl,
    SUPABASE_URL: input.supabaseUrl,
    SUPABASE_ANON_KEY: input.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: input.serviceRoleKey,
    SUPABASE_STORAGE_BUCKET: input.bucket,
    STORAGE_DRIVER: 'supabase',
  };
  const existing = fs.existsSync(ENV_LOCAL_FILE)
    ? fs.readFileSync(ENV_LOCAL_FILE, 'utf8').split('\n')
    : [];
  const kept = existing.filter(
    (line) => !Object.keys(values).some((key) => line.startsWith(`${key}=`)),
  );
  const lines = [
    ...kept.filter((line, i) => line.trim() !== '' || i < kept.length - 1),
    '# Added by Connect Supabase (Security page)',
    ...Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`),
    '',
  ];
  fs.writeFileSync(ENV_LOCAL_FILE, lines.join('\n'), { mode: 0o600 });
  return Object.keys(values);
}
