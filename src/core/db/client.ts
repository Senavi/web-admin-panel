import 'server-only';

import { env, isProduction } from '@/core/env';

import { describeDatabase } from './info';
import { runSeed } from './seed';
import type { Database, DbInfo } from './types';

interface DbState {
  promise?: Promise<Database>;
}

// Survives Next.js dev hot reloads, so only one PGlite instance / pool exists per process.
const globalState = globalThis as typeof globalThis & { __siteStarterDb?: DbState };
const state: DbState = (globalState.__siteStarterDb ??= {});

async function connect(): Promise<Database> {
  const { DATABASE_URL } = env();

  if (DATABASE_URL) {
    const { openPostgres } = await import('./drivers/postgres');
    return openPostgres(DATABASE_URL).db;
  }

  if (isProduction()) {
    // Also enforced by env validation; kept here as a last line of defence.
    throw new Error('DATABASE_URL is required in production. PGlite only runs in development.');
  }

  // `pnpm dev` owns the PGlite database and serves it to every Next.js worker process.
  const { findLocalServerUrl } = await import('./drivers/local-server-info');
  const localUrl = findLocalServerUrl();
  if (localUrl) {
    const { openPostgres } = await import('./drivers/postgres');
    return openPostgres(localUrl, { max: 3 }).db;
  }

  // Single-process fallback (e.g. `next dev` started directly): open PGlite in-process.
  const { openPglite } = await import('./drivers/pglite');
  const { db } = await openPglite();
  await runSeed(db, { seedDevAdmin: true });
  return db;
}

/**
 * Returns the shared database. Local PGlite is migrated and seeded on first use.
 * Production databases are migrated during deploy (`pnpm db:migrate`).
 */
export function getDb(): Promise<Database> {
  state.promise ??= connect().catch((error: unknown) => {
    state.promise = undefined;
    throw error;
  });
  return state.promise;
}

/** Database mode and masked host. Reads only DATABASE_URL, so it is safe during prerendering. */
export function getDbInfo(): DbInfo {
  return describeDatabase(process.env.DATABASE_URL?.trim() || undefined);
}
