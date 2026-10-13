import 'server-only';

import { runSeed } from '@/core/db/seed';
import type { Database } from '@/core/db/types';
import { env } from '@/core/env';

import { enableRowLevelSecurity, ensureStorageBucket } from './supabase-connect';

/**
 * Deploy step after migrations (`pnpm db:migrate:deploy`), so a fresh Supabase
 * project works with only DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
 * Row Level Security on every table, the media bucket, then default settings and
 * the demo content (missing data only; edited content is never overwritten).
 * Idempotent; returns what it did for the build log.
 */
export async function prepareDatabase(db: Database): Promise<string[]> {
  const done: string[] = [];
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET } = env();
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const tables = await enableRowLevelSecurity(db);
    done.push(`Row Level Security on ${tables.length} tables`);
    await ensureStorageBucket({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      bucket: SUPABASE_STORAGE_BUCKET,
    });
    done.push(`storage bucket "${SUPABASE_STORAGE_BUCKET}"`);
  }
  await runSeed(db, { seedDevAdmin: false });
  done.push('default settings and demo content (missing data only)');
  return done;
}
