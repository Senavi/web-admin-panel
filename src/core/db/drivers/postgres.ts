import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

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

/**
 * Connects through postgres-js. `prepare: false` is required for the Supabase
 * transaction pooler (PgBouncer) used by serverless deployments.
 */
export function openPostgres(url: string, options: PostgresOptions = {}): PostgresConnection {
  const client = postgres(url, {
    prepare: false,
    max: options.max ?? 5,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => undefined,
  });
  const db = drizzle({ client, schema });
  return { db, close: () => client.end({ timeout: 5 }) };
}

/** Applies committed migrations using a dedicated single connection (use the direct URL). */
export async function migratePostgres(url: string): Promise<void> {
  const client = postgres(url, { prepare: false, max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await client.end({ timeout: 5 });
  }
}
