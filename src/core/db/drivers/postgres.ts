import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { ConnectionKind, describeConnection } from '../connection-info';
import { MIGRATIONS_DIR } from '../paths';
import * as schema from '../schema';
import type { Database } from '../types';

export interface PostgresConnection {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

export interface PostgresOptions {
  /** Max pool size. Serverless functions should stay small. */
  readonly max?: number;
}

/** Session-mode pooler: each open connection holds a server slot, so release them quickly. */
const SESSION_POOL = { max: 1, idleTimeoutSeconds: 5 };
const DEFAULT_POOL = { max: 5, idleTimeoutSeconds: 20 };

/**
 * Connects through postgres-js. `prepare: false` is required for the Supabase
 * transaction pooler (Supavisor/PgBouncer) used by serverless deployments.
 * On the shared SESSION pooler every instance keeps at most one connection
 * with a short idle timeout, so serverless instances don't exhaust the
 * project's session pool (D-086).
 */
export function openPostgres(url: string, options: PostgresOptions = {}): PostgresConnection {
  const pool =
    describeConnection(url)?.kind === ConnectionKind.SharedSession ? SESSION_POOL : DEFAULT_POOL;
  const client = postgres(url, {
    prepare: false,
    max: Math.min(options.max ?? pool.max, pool.max),
    idle_timeout: pool.idleTimeoutSeconds,
    connect_timeout: 10,
    onnotice: () => undefined,
  });
  const db = drizzle({ client, schema });
  return { db, close: () => client.end({ timeout: 5 }) };
}

/** Applies committed migrations over one connection (use `migrationUrl()`: session mode or direct). */
export async function migratePostgres(url: string): Promise<void> {
  const client = postgres(url, { prepare: false, max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await client.end({ timeout: 5 });
  }
}
