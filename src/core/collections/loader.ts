import 'server-only';

import { and, asc, count, desc, eq, exists, inArray, type SQL, sql } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';

import { type registry } from '@/content';
import { CacheTag } from '@/core/cache/tags';
import {
  type AnyCollection,
  collectionBasePath,
  collectionItemPath,
  CollectionItemStatus,
  ITEM_SECTION,
  MissingTranslation,
} from '@/core/content/collection';
import type { ResolvedSection } from '@/core/content/define';
import type { ImageValue } from '@/core/content/fields';
import { contentRegistry } from '@/core/content/project-registry';
import { collectionItemStore } from '@/core/content/stores/table-store';
import {
  collectMediaIds,
  type ContentRecord,
  resolveImages,
  resolveWithFallback,
} from '@/core/content/values';
import { getDb } from '@/core/db/client';
import {
  collectionItemContent,
  collectionItems,
  collectionItemSeo,
  collectionSlugRedirects,
  SHARED_LOCALE,
} from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { localizedPath } from '@/core/i18n/routing';
import { loadMedia, toResolvedImage } from '@/core/media/resolve';
import { type PageSeo, parsePageSeo } from '@/core/seo/page-seo';
import { getSiteSettings } from '@/core/settings/loader';

import type { CollectionGateState } from './gate';

/**
 * Public-site reads of collections (published items only, unless a staff
 * member previews a draft in Draft Mode). Cached and tagged
 * `collection:{id}:list`, `collection:{id}:{slug}` and `collection:{id}`.
 */

type RegisteredCollection = (typeof registry.collections)[number];
export type CollectionId = RegisteredCollection['id'];
type CollectionById<Id extends CollectionId> = Extract<RegisteredCollection, { id: Id }>;

/** Item fields as the site receives them (images resolved), typed from the definition. */
export type CollectionItemContent<Id extends CollectionId> = ResolvedSection<
  CollectionById<Id>['fields']
>;

export interface CollectionItemData<C> {
  readonly id: string;
  readonly slug: string;
  /** Localized URL path, e.g. `/uk/blog/hello`. */
  readonly href: string;
  readonly locale: string;
  readonly title: string;
  /** ISO timestamp, null for drafts never published. */
  readonly publishedAt: string | null;
  readonly updatedAt: string;
  readonly status: CollectionItemStatus;
  readonly content: C;
}

export type SiteCollectionItem<Id extends CollectionId> = CollectionItemData<
  CollectionItemContent<Id>
>;

export interface CollectionPage<T> {
  readonly items: readonly T[];
  /** 1-based page number. */
  readonly page: number;
  /** At least 1 (an empty collection has one empty page). */
  readonly pageCount: number;
  readonly total: number;
}

type ItemRow = Pick<
  typeof collectionItems.$inferSelect,
  'id' | 'slug' | 'status' | 'publishedAt' | 'updatedAt'
>;
type GenericItem = CollectionItemData<ContentRecord[string]>;

const ITEM_COLUMNS = {
  id: collectionItems.id,
  slug: collectionItems.slug,
  status: collectionItems.status,
  publishedAt: collectionItems.publishedAt,
  updatedAt: collectionItems.updatedAt,
};

function collectionOrThrow(collectionId: string): AnyCollection {
  const collection = contentRegistry.collectionById(collectionId);
  if (!collection) throw new Error(`Unknown collection "${collectionId}".`);
  return collection;
}

/** Items in a locale: published, and translated when the collection hides missing translations. */
function visibleIn(
  db: Database,
  collection: AnyCollection,
  locale: string,
  defaultLocale: string,
  includeDrafts = false,
): SQL | undefined {
  const translated =
    collection.missingTranslation === MissingTranslation.Hide && locale !== defaultLocale
      ? exists(
          db
            .select({ one: sql`1` })
            .from(collectionItemContent)
            .where(
              and(
                eq(collectionItemContent.itemId, collectionItems.id),
                eq(collectionItemContent.locale, locale),
              ),
            ),
        )
      : undefined;
  return and(
    eq(collectionItems.collectionId, collection.id),
    includeDrafts ? undefined : eq(collectionItems.status, CollectionItemStatus.Published),
    translated,
  );
}

/** Resolves stored content (fallback + images) for a batch of items. */
async function buildItems(
  db: Database,
  collection: AnyCollection,
  rows: readonly ItemRow[],
  locale: string,
  defaultLocale: string,
): Promise<GenericItem[]> {
  if (rows.length === 0) return [];
  const contentRows = await collectionItemStore.readContentRows(
    db,
    rows.map((row) => row.id),
    [locale, defaultLocale],
  );
  const byItem = new Map<string, Map<string, ContentRecord>>();
  for (const row of contentRows) {
    const map = byItem.get(row.key) ?? new Map<string, ContentRecord>();
    map.set(row.locale, row.data);
    byItem.set(row.key, map);
  }
  const { schema } = collection;
  const contents = rows.map((row) => {
    const stored = byItem.get(row.id);
    const shared = stored?.get(SHARED_LOCALE);
    return resolveWithFallback(schema, {
      primary: { shared, localized: stored?.get(locale) },
      defaultLocale:
        locale === defaultLocale ? undefined : { shared, localized: stored?.get(defaultLocale) },
      seeds: [],
    });
  });
  const mediaById = await loadMedia(
    db,
    contents.flatMap((content) => collectMediaIds(schema, content)),
  );
  return rows.map((row, index) => {
    const resolved = resolveImages(schema, contents[index] ?? {}, (image: ImageValue) =>
      toResolvedImage(image, mediaById),
    );
    const content = resolved[ITEM_SECTION] ?? {};
    const title = content[collection.titleField];
    return {
      id: row.id,
      slug: row.slug,
      href: localizedPath(collectionItemPath(collection, row.slug), locale, defaultLocale),
      locale,
      title: typeof title === 'string' ? title : '',
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      status: row.status,
      content,
    };
  });
}

function compareBy(field: string, direction: 'asc' | 'desc') {
  const sign = direction === 'asc' ? 1 : -1;
  return (a: GenericItem, b: GenericItem): number => {
    const left = a.content[field];
    const right = b.content[field];
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * sign;
    return String(left ?? '').localeCompare(String(right ?? '')) * sign;
  };
}

async function loadList(
  collectionId: string,
  locale: string,
  page: number,
): Promise<CollectionPage<GenericItem>> {
  'use cache';
  cacheLife('max');
  cacheTag(
    CacheTag.collectionList(collectionId),
    CacheTag.collection(collectionId),
    CacheTag.Settings,
  );
  const collection = collectionOrThrow(collectionId);
  const db = await getDb();
  const { defaultLocale } = (await getSiteSettings()).general;
  const where = visibleIn(db, collection, locale, defaultLocale);
  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(collectionItems)
    .where(where);
  const { pageSize, sort } = collection;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (page > pageCount) return { items: [], page, pageCount, total };
  const offset = (page - 1) * pageSize;

  if (sort.by === 'publishedAt') {
    const order = sort.direction === 'asc' ? asc : desc;
    const rows = await db
      .select(ITEM_COLUMNS)
      .from(collectionItems)
      .where(where)
      .orderBy(
        sql`${order(collectionItems.publishedAt)} nulls last`,
        desc(collectionItems.createdAt),
      )
      .limit(pageSize)
      .offset(offset);
    return {
      items: await buildItems(db, collection, rows, locale, defaultLocale),
      page,
      pageCount,
      total,
    };
  }
  // Field sort: values live in JSON per locale, so the visible set is sorted in memory.
  const rows = await db.select(ITEM_COLUMNS).from(collectionItems).where(where);
  const items = (await buildItems(db, collection, rows, locale, defaultLocale)).sort(
    compareBy(sort.by, sort.direction),
  );
  return { items: items.slice(offset, offset + pageSize), page, pageCount, total };
}

/**
 * One page of published items in a locale, typed from the collection's fields.
 * `page` is 1-based; a page beyond `pageCount` returns no items (render a 404).
 */
export async function getCollectionList<Id extends CollectionId>(
  collectionId: Id,
  locale: string,
  options: { readonly page?: number } = {},
): Promise<CollectionPage<SiteCollectionItem<Id>>> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  // Items are built from the collection's own schema, so they match the inferred type.
  return (await loadList(collectionId, locale, page)) as unknown as CollectionPage<
    SiteCollectionItem<Id>
  >;
}

async function loadItem(
  collectionId: string,
  slug: string,
  locale: string,
  includeDrafts: boolean,
): Promise<GenericItem | null> {
  'use cache';
  cacheLife('max');
  cacheTag(
    CacheTag.collectionItem(collectionId, slug),
    CacheTag.collection(collectionId),
    CacheTag.Settings,
  );
  const collection = collectionOrThrow(collectionId);
  const db = await getDb();
  const { defaultLocale } = (await getSiteSettings()).general;
  const [row] = await db
    .select(ITEM_COLUMNS)
    .from(collectionItems)
    .where(
      and(
        visibleIn(db, collection, locale, defaultLocale, includeDrafts),
        eq(collectionItems.slug, slug),
      ),
    );
  if (!row) return null;
  const [item] = await buildItems(db, collection, [row], locale, defaultLocale);
  return item ?? null;
}

/** A published item by slug in a locale, or null (unknown, draft or hidden translation). */
export async function getCollectionItem<Id extends CollectionId>(
  collectionId: Id,
  slug: string,
  locale: string,
): Promise<SiteCollectionItem<Id> | null> {
  return (await loadItem(collectionId, slug, locale, false)) as SiteCollectionItem<Id> | null;
}

/** Item including drafts (staff preview in Draft Mode, where caches are bypassed). */
export async function getCollectionItemPreview(
  collectionId: string,
  slug: string,
  locale: string,
): Promise<GenericItem | null> {
  return loadItem(collectionId, slug, locale, true);
}

/** Current slug of the item an old slug pointed to (308 redirect), or null. */
export async function findSlugRedirect(collectionId: string, slug: string): Promise<string | null> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.collectionItem(collectionId, slug), CacheTag.collection(collectionId));
  const db = await getDb();
  const [row] = await db
    .select({ slug: collectionItems.slug, status: collectionItems.status })
    .from(collectionSlugRedirects)
    .innerJoin(collectionItems, eq(collectionItems.id, collectionSlugRedirects.itemId))
    .where(
      and(
        eq(collectionSlugRedirects.collectionId, collectionId),
        eq(collectionSlugRedirects.oldSlug, slug),
      ),
    );
  return row && row.status === CollectionItemStatus.Published && row.slug !== slug
    ? row.slug
    : null;
}

/** Slugs of items visible in a locale (static params). */
export async function getPublishedSlugs(collectionId: string, locale: string): Promise<string[]> {
  'use cache';
  cacheLife('max');
  cacheTag(
    CacheTag.collectionList(collectionId),
    CacheTag.collection(collectionId),
    CacheTag.Settings,
  );
  const collection = collectionOrThrow(collectionId);
  const db = await getDb();
  const { defaultLocale } = (await getSiteSettings()).general;
  const rows = await db
    .select({ slug: collectionItems.slug })
    .from(collectionItems)
    .where(visibleIn(db, collection, locale, defaultLocale));
  return rows.map((row) => row.slug);
}

interface PublishedItem {
  readonly id: string;
  readonly collection: AnyCollection;
  readonly slug: string;
  readonly updatedAt: Date;
  /** Locales where the item is shown (hidden translations excluded). */
  readonly locales: readonly string[];
  /** Locales whose SEO marks the item noindex. */
  readonly noindex: ReadonlySet<string>;
}

/** Published items of every collection with their visible locales (one pass, three queries). */
async function loadPublishedItems(
  db: Database,
  enabledLocales: readonly string[],
  defaultLocale: string,
): Promise<PublishedItem[]> {
  const collectionIds = contentRegistry.collections.map((collection) => collection.id);
  if (collectionIds.length === 0) return [];
  const rows = await db
    .select({
      id: collectionItems.id,
      collectionId: collectionItems.collectionId,
      slug: collectionItems.slug,
      updatedAt: collectionItems.updatedAt,
    })
    .from(collectionItems)
    .where(
      and(
        eq(collectionItems.status, CollectionItemStatus.Published),
        inArray(collectionItems.collectionId, collectionIds),
      ),
    );
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [translations, seoRows] = await Promise.all([
    db
      .select({ itemId: collectionItemContent.itemId, locale: collectionItemContent.locale })
      .from(collectionItemContent)
      .where(inArray(collectionItemContent.itemId, ids)),
    db
      .select({
        itemId: collectionItemSeo.itemId,
        locale: collectionItemSeo.locale,
        data: collectionItemSeo.data,
      })
      .from(collectionItemSeo)
      .where(inArray(collectionItemSeo.itemId, ids)),
  ]);
  const translated = new Set(translations.map((row) => `${row.itemId}:${row.locale}`));
  const noindexByItem = new Map<string, Set<string>>();
  for (const row of seoRows) {
    if (!parsePageSeo(row.data).noindex) continue;
    const set = noindexByItem.get(row.itemId) ?? new Set<string>();
    set.add(row.locale);
    noindexByItem.set(row.itemId, set);
  }
  return rows.flatMap((row) => {
    const collection = contentRegistry.collectionById(row.collectionId);
    if (!collection) return [];
    const locales = enabledLocales.filter(
      (locale) =>
        collection.missingTranslation === MissingTranslation.Fallback ||
        locale === defaultLocale ||
        translated.has(`${row.id}:${locale}`),
    );
    return [
      {
        id: row.id,
        collection,
        slug: row.slug,
        updatedAt: row.updatedAt,
        locales,
        noindex: noindexByItem.get(row.id) ?? new Set<string>(),
      },
    ];
  });
}

export interface CollectionSitemapItem {
  readonly path: string;
  readonly lastModified: string;
  /** Locales where the item is visible and indexable. */
  readonly locales: readonly string[];
}

/** Published items of every collection for the sitemap (hidden translations and noindex excluded). */
export async function getCollectionSitemapItems(
  enabledLocales: readonly string[],
  defaultLocale: string,
): Promise<CollectionSitemapItem[]> {
  'use cache';
  cacheLife('max');
  cacheTag(
    CacheTag.Sitemap,
    CacheTag.Settings,
    ...contentRegistry.collections.map((collection) => CacheTag.collectionList(collection.id)),
  );
  const items = await loadPublishedItems(await getDb(), enabledLocales, defaultLocale);
  return items.flatMap((item) => {
    const locales = item.locales.filter((locale) => !item.noindex.has(locale));
    return locales.length > 0
      ? [
          {
            path: collectionItemPath(item.collection, item.slug),
            lastModified: item.updatedAt.toISOString(),
            locales,
          },
        ]
      : [];
  });
}

/** What the request proxy needs to answer 404/308 for collection URLs (see gate.ts). */
export async function getCollectionGateState(
  enabledLocales: readonly string[],
  defaultLocale: string,
): Promise<CollectionGateState[]> {
  'use cache';
  cacheLife('max');
  cacheTag(
    CacheTag.Settings,
    ...contentRegistry.collections.map((collection) => CacheTag.collectionList(collection.id)),
  );
  if (contentRegistry.collections.length === 0) return [];
  const db = await getDb();
  const [items, redirects] = await Promise.all([
    loadPublishedItems(db, enabledLocales, defaultLocale),
    db
      .select({
        collectionId: collectionSlugRedirects.collectionId,
        oldSlug: collectionSlugRedirects.oldSlug,
        slug: collectionItems.slug,
      })
      .from(collectionSlugRedirects)
      .innerJoin(collectionItems, eq(collectionItems.id, collectionSlugRedirects.itemId)),
  ]);
  return contentRegistry.collections.map((collection) => ({
    itemPath: collection.itemPath,
    listPath: collectionBasePath(collection),
    pageSize: collection.pageSize,
    items: Object.fromEntries(
      items
        .filter((item) => item.collection.id === collection.id)
        .map((item) => [item.slug, item.locales]),
    ),
    redirects: Object.fromEntries(
      redirects
        .filter((row) => row.collectionId === collection.id && row.oldSlug !== row.slug)
        .map((row) => [row.oldSlug, row.slug]),
    ),
  }));
}

/** SEO overrides of an item in a locale (cached with the item). */
export async function getItemSeo(
  collectionId: string,
  slug: string,
  itemId: string,
  locale: string,
): Promise<PageSeo> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.collectionItem(collectionId, slug), CacheTag.collection(collectionId));
  const seo = await collectionItemStore.readSeo(await getDb(), itemId, locale);
  return parsePageSeo(seo?.data);
}
