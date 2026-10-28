import 'server-only';

import { readDatabaseMarker } from '@/core/database/environment-marker';
import { getDb } from '@/core/db/client';
import { databaseIdentity } from '@/core/db/connection-info';
import { env } from '@/core/env';

import { currentEnvironment } from './current';
import { DATABASE_MISMATCH_MESSAGES, detectDatabaseMismatch } from './database-check';

let cached: Promise<string | null> | null = null;

async function readMismatch(): Promise<string | null> {
  const url = env().DATABASE_URL;
  // Local PGlite and preview mode have no marker to compare.
  if (!url) return null;
  const marker = await readDatabaseMarker(await getDb());
  const mismatch = detectDatabaseMismatch(currentEnvironment(), marker, databaseIdentity(url));
  return mismatch ? DATABASE_MISMATCH_MESSAGES[mismatch] : null;
}

/**
 * The wrong-database warning (D-099), or null. Read once per server instance (the
 * marker changes only with a deploy, which starts new instances); a failed read
 * (e.g. not migrated yet) is retried on the next call.
 */
export function databaseMismatchWarning(): Promise<string | null> {
  cached ??= readMismatch().catch(() => {
    cached = null;
    return null;
  });
  return cached;
}
