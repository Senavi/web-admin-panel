import type { SQL } from 'drizzle-orm';

import type { Database } from './types';

/**
 * Raw SQL rows on either driver (postgres-js returns an array, PGlite `{ rows }`).
 * Prefer the query builder; use this only for server functions it can't express.
 */
export async function executeRows<T>(db: Database, query: SQL): Promise<T[]> {
  const result: unknown = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: unknown[] }).rows ?? []) as T[];
}
