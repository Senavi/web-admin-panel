import 'server-only';

import { and, eq } from 'drizzle-orm';

import type { AnyCollection } from '@/core/content/collection';
import { resolveWithFallback } from '@/core/content/values';
import { storedRowsFor, type DocumentRows } from '@/core/content/store';
import { collectionItemStore } from '@/core/content/stores/table-store';
import { collectionItems } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

import { ITEM_SECTION } from '@/core/content/collection';

export type CollectionItemRow = typeof collectionItems.$inferSelect;

export async function findItem(
  db: Database,
  collectionId: string,
  itemId: string,
): Promise<CollectionItemRow | null> {
  const [row] = await db
    .select()
    .from(collectionItems)
    .where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.id, itemId)));
  return row ?? null;
}

/** Plain-text value of a text field of an item in a locale (with default-locale fallback). */
export function itemText(
  collection: AnyCollection,
  rows: DocumentRows,
  field: string | undefined,
  locale: string,
  defaultLocale: string,
): string {
  if (!field) return '';
  const content = resolveWithFallback(collection.schema, {
    primary: storedRowsFor(rows, locale),
    defaultLocale: locale === defaultLocale ? undefined : storedRowsFor(rows, defaultLocale),
    seeds: [],
  });
  const value = content[ITEM_SECTION]?.[field];
  return typeof value === 'string' ? value : '';
}

export function readItemRows(db: Database, itemId: string, locales: readonly string[]) {
  return collectionItemStore.readRows(db, itemId, locales);
}
