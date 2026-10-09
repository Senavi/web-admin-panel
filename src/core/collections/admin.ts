import 'server-only';

import { and, count, desc, eq, inArray } from 'drizzle-orm';

import {
  type AnyCollection,
  type CollectionItemStatus,
  ITEM_SECTION,
} from '@/core/content/collection';
import type { LocaleStatus } from '@/core/content/editor-types';
import { localeStatuses } from '@/core/content/editor';
import { collectionItemStore } from '@/core/content/stores/table-store';
import type { ContentRecord } from '@/core/content/values';
import { collectionItems, collectionSlugRedirects, SHARED_LOCALE, users } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

/** Admin collection screen: table rows, filters and item counts. */

export const ItemSort = {
  Updated: 'updated',
  Published: 'published',
  Title: 'title',
} as const;
export type ItemSort = (typeof ItemSort)[keyof typeof ItemSort];

export const STATUS_FILTER_ALL = 'all';
export const ITEM_TABLE_PAGE_SIZE = 20;

export interface ItemTableQuery {
  readonly search: string;
  readonly status: CollectionItemStatus | typeof STATUS_FILTER_ALL;
  readonly sort: ItemSort;
  readonly page: number;
}

export interface ItemTableRow {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly status: CollectionItemStatus;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
  readonly updatedBy: string | null;
  readonly statuses: Readonly<Record<string, LocaleStatus>>;
}

export interface ItemTable {
  readonly rows: readonly ItemTableRow[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

function titleOf(
  collection: AnyCollection,
  stored: ReadonlyMap<string, ContentRecord> | undefined,
  defaultLocale: string,
) {
  const field = collection.schema.sections[0].fields[collection.titleField];
  const record = field?.localized ? stored?.get(defaultLocale) : stored?.get(SHARED_LOCALE);
  const value = record?.[ITEM_SECTION]?.[collection.titleField];
  return typeof value === 'string' ? value : '';
}

/**
 * Items of a collection for the admin table. Titles live in JSON per locale, so
 * search and title sort run in memory (fine for thousands of items).
 */
export async function loadItemTable(
  db: Database,
  collection: AnyCollection,
  query: ItemTableQuery,
  locales: readonly string[],
  defaultLocale: string,
): Promise<ItemTable> {
  const items = await db
    .select({
      id: collectionItems.id,
      slug: collectionItems.slug,
      status: collectionItems.status,
      publishedAt: collectionItems.publishedAt,
      updatedAt: collectionItems.updatedAt,
      updatedBy: users.name,
    })
    .from(collectionItems)
    .leftJoin(users, eq(users.id, collectionItems.updatedBy))
    .where(
      and(
        eq(collectionItems.collectionId, collection.id),
        query.status === STATUS_FILTER_ALL ? undefined : eq(collectionItems.status, query.status),
      ),
    )
    .orderBy(desc(collectionItems.updatedAt));
  const contentRows = await collectionItemStore.readContentRows(
    db,
    items.map((item) => item.id),
    locales,
  );
  const byItem = new Map<string, Map<string, ContentRecord>>();
  for (const row of contentRows) {
    const map = byItem.get(row.key) ?? new Map<string, ContentRecord>();
    map.set(row.locale, row.data);
    byItem.set(row.key, map);
  }

  const needle = query.search.trim().toLowerCase();
  const rows = items
    .map((item) => {
      const stored = byItem.get(item.id);
      return {
        id: item.id,
        title: titleOf(collection, stored, defaultLocale),
        slug: item.slug,
        status: item.status,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        updatedAt: item.updatedAt.toISOString(),
        updatedBy: item.updatedBy,
        statuses: localeStatuses(collection.schema, stored, locales),
      };
    })
    .filter(
      (row) => !needle || row.title.toLowerCase().includes(needle) || row.slug.includes(needle),
    );

  if (query.sort === ItemSort.Title) rows.sort((a, b) => a.title.localeCompare(b.title));
  if (query.sort === ItemSort.Published) {
    rows.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  }
  const pageCount = Math.max(1, Math.ceil(rows.length / ITEM_TABLE_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * ITEM_TABLE_PAGE_SIZE;
  return {
    rows: rows.slice(start, start + ITEM_TABLE_PAGE_SIZE),
    total: rows.length,
    page,
    pageCount,
  };
}

/** Number of items per collection (Pages sidebar). */
export async function countItems(
  db: Database,
  collectionIds: readonly string[],
): Promise<Record<string, number>> {
  if (collectionIds.length === 0) return {};
  const rows = await db
    .select({ collectionId: collectionItems.collectionId, total: count() })
    .from(collectionItems)
    .where(inArray(collectionItems.collectionId, [...collectionIds]))
    .groupBy(collectionItems.collectionId);
  return Object.fromEntries(rows.map((row) => [row.collectionId, row.total]));
}

/** Slugs in use by other items of the collection (current slugs and redirected old slugs). */
export async function takenSlugs(
  db: Database,
  collectionId: string,
  exceptItemId?: string,
): Promise<Set<string>> {
  const [current, redirected] = await Promise.all([
    db
      .select({ slug: collectionItems.slug, id: collectionItems.id })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId)),
    db
      .select({ slug: collectionSlugRedirects.oldSlug, id: collectionSlugRedirects.itemId })
      .from(collectionSlugRedirects)
      .where(eq(collectionSlugRedirects.collectionId, collectionId)),
  ]);
  return new Set(
    [...current, ...redirected].filter((row) => row.id !== exceptItemId).map((row) => row.slug),
  );
}
