import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import type * as schema from './schema';

export type Schema = typeof schema;

/** Driver-agnostic Drizzle database (PGlite in development, postgres-js otherwise). */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

export const DbMode = {
  /** Embedded PGlite (development only). */
  Local: 'local',
  /** External Postgres via postgres-js (Supabase in production). */
  Postgres: 'postgres',
} as const;
export type DbMode = (typeof DbMode)[keyof typeof DbMode];

export interface DbInfo {
  readonly mode: DbMode;
  /** Host with credentials removed, e.g. `aws-0-eu-central-1.pooler.supabase.com:6543`. */
  readonly host: string | null;
}
