import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';

import * as schema from '@/core/db/schema';
import type { Database } from '@/core/db/types';

/**
 * Tables copied by "Migrate data", in foreign-key order. Sessions, rate limits,
 * analytics and the audit log are not copied (users simply sign in again).
 * Content, collections and form submissions (with their delivery state) are.
 */
export const COPY_TABLES = [
  schema.users,
  schema.accounts,
  schema.twoFactors,
  schema.settings,
  schema.settingsLocalized,
  schema.media,
  schema.pageContent,
  schema.pageSeo,
  schema.pageRevisions,
  schema.collectionItems,
  schema.collectionItemContent,
  schema.collectionItemSeo,
  schema.collectionItemRevisions,
  schema.collectionSlugRedirects,
  schema.collectionSeedLog,
  schema.formSubmissions,
] as const;

const BATCH = 200;

/** Copies rows that don't exist in the target yet (idempotent). Returns rows copied per table. */
export async function copyTables(from: Database, to: Database): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const table of COPY_TABLES) {
    const rows = await from.select().from(table);
    let copied = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      // Generic over the table list: each batch has exactly that table's row shape.
      const inserted = await to
        .insert(table)
        .values(batch as never)
        .onConflictDoNothing()
        .returning();
      copied += inserted.length;
    }
    result[getTableName(table)] = copied;
  }
  return result;
}

/** Every application table (for enabling Row Level Security). */
export function appTableNames(): string[] {
  const names: string[] = [];
  for (const value of Object.values(schema) as unknown[]) {
    if (is(value, PgTable)) names.push(getTableName(value));
  }
  return names;
}
