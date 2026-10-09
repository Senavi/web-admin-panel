import 'server-only';

import { and, desc, eq, inArray, notInArray, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import {
  collectionItemContent,
  collectionItemRevisions,
  collectionItemSeo,
  pageContent,
  pageRevisions,
  pageSeo,
  SHARED_LOCALE,
} from '@/core/db/schema';

import { type DocumentStore, toDocumentRows } from '../store';
import type { ContentRecord } from '../values';

/**
 * One `DocumentStore` implementation for every table set with the page-table
 * shape (`<key>, locale, data, version, updated_at, updated_by` for content and
 * SEO; `id, <key>, locale, snapshot, author…` for revisions). The factory is
 * typed against the page tables; other sets only differ in their key column,
 * which is passed explicitly (`contentKey`/`seoKey`/`revisionKey`, `keyValue`).
 */
interface TableSet {
  readonly content: typeof pageContent;
  readonly seo: typeof pageSeo;
  readonly revisions: typeof pageRevisions;
  readonly contentKey: AnyPgColumn;
  readonly seoKey: AnyPgColumn;
  readonly revisionKey: AnyPgColumn;
  /** Key column value for inserts, e.g. `{ pageId: key }`. */
  readonly keyValue: (key: string) => { pageId: string };
}

function createTableStore(tables: TableSet): DocumentStore {
  const { content, seo, revisions, contentKey, seoKey, revisionKey, keyValue } = tables;
  const seoWhere = (key: string, locale: string): SQL | undefined =>
    and(eq(seoKey, key), eq(seo.locale, locale));
  const revisionWhere = (key: string, locale: string): SQL | undefined =>
    and(eq(revisionKey, key), eq(revisions.locale, locale));

  return {
    async readRows(db, key, locales) {
      const rows = await db
        .select({
          locale: content.locale,
          data: content.data,
          version: content.version,
          updatedAt: content.updatedAt,
        })
        .from(content)
        .where(and(eq(contentKey, key), inArray(content.locale, [SHARED_LOCALE, ...locales])));
      return toDocumentRows(rows, SHARED_LOCALE);
    },

    async readSeo(db, key, locale) {
      const [row] = await db
        .select({ data: seo.data, version: seo.version })
        .from(seo)
        .where(seoWhere(key, locale));
      return row ?? null;
    },

    async writeContent(db, key, locale, data, expected, { userId, now }) {
      if (expected === 0) {
        const inserted = await db
          .insert(content)
          .values({
            ...keyValue(key),
            locale,
            data,
            version: 1,
            updatedBy: userId,
            updatedAt: now,
          })
          .onConflictDoNothing()
          .returning({ version: content.version });
        return inserted[0]?.version ?? null;
      }
      const [updated] = await db
        .update(content)
        .set({ data, version: sql`${content.version} + 1`, updatedBy: userId, updatedAt: now })
        .where(and(eq(contentKey, key), eq(content.locale, locale), eq(content.version, expected)))
        .returning({ version: content.version });
      return updated?.version ?? null;
    },

    async writeSeo(db, key, locale, value, expected, { userId, now }) {
      const data = { ...value };
      if (expected === 0) {
        const inserted = await db
          .insert(seo)
          .values({
            ...keyValue(key),
            locale,
            data,
            version: 1,
            updatedBy: userId,
            updatedAt: now,
          })
          .onConflictDoNothing()
          .returning({ version: seo.version });
        return inserted[0]?.version ?? null;
      }
      const [updated] = await db
        .update(seo)
        .set({ data, version: sql`${seo.version} + 1`, updatedBy: userId, updatedAt: now })
        .where(and(seoWhere(key, locale), eq(seo.version, expected)))
        .returning({ version: seo.version });
      return updated?.version ?? null;
    },

    async addRevision(db, key, locale, snapshot, author) {
      await db.insert(revisions).values({
        ...keyValue(key),
        locale,
        snapshot,
        authorId: author.id,
        authorName: author.name,
      });
    },

    async pruneRevisions(db, key, locale, keep) {
      const newest = await db
        .select({ id: revisions.id })
        .from(revisions)
        .where(revisionWhere(key, locale))
        .orderBy(desc(revisions.createdAt))
        .limit(keep);
      await db.delete(revisions).where(
        and(
          revisionWhere(key, locale),
          notInArray(
            revisions.id,
            newest.map((row) => row.id),
          ),
        ),
      );
    },

    async listRevisions(db, key, locale) {
      const rows = await db
        .select({
          id: revisions.id,
          createdAt: revisions.createdAt,
          authorName: revisions.authorName,
        })
        .from(revisions)
        .where(revisionWhere(key, locale))
        .orderBy(desc(revisions.createdAt));
      return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
    },

    async readRevision(db, revisionId) {
      const [row] = await db
        .select({ key: revisionKey, locale: revisions.locale, snapshot: revisions.snapshot })
        .from(revisions)
        .where(eq(revisions.id, revisionId));
      return row ? { ...row, key: String(row.key) } : null;
    },

    async readContentRows(db, keys, locales) {
      if (keys.length === 0) return [];
      const rows = await db
        .select({ key: contentKey, locale: content.locale, data: content.data })
        .from(content)
        .where(
          and(inArray(contentKey, [...keys]), inArray(content.locale, [SHARED_LOCALE, ...locales])),
        );
      return rows.map((row) => ({ ...row, key: String(row.key), data: row.data as ContentRecord }));
    },
  };
}

/**
 * Pages (`<pageId>`), plus the namespaced keys of globals (`global:<id>`) and
 * form texts (`form:<id>`). Page ids are kebab-case, so they never collide.
 */
export const pageStore = createTableStore({
  content: pageContent,
  seo: pageSeo,
  revisions: pageRevisions,
  contentKey: pageContent.pageId,
  seoKey: pageSeo.pageId,
  revisionKey: pageRevisions.pageId,
  keyValue: (key) => ({ pageId: key }),
});

/**
 * Collection items (key = item id). The `collection_item_*` tables have exactly
 * the page tables' columns with `item_id` instead of `page_id`, so they are
 * viewed through the page-table types here (the only place this is done).
 */
export const collectionItemStore = createTableStore({
  content: collectionItemContent as unknown as typeof pageContent,
  seo: collectionItemSeo as unknown as typeof pageSeo,
  revisions: collectionItemRevisions as unknown as typeof pageRevisions,
  contentKey: collectionItemContent.itemId,
  seoKey: collectionItemSeo.itemId,
  revisionKey: collectionItemRevisions.itemId,
  keyValue: (key) => ({ itemId: key }) as unknown as { pageId: string },
});
