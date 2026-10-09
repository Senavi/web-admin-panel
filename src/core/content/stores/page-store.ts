import 'server-only';

import { and, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';

import { pageContent, pageRevisions, pageSeo, SHARED_LOCALE } from '@/core/db/schema';

import { type DocumentStore, toDocumentRows } from '../store';
import type { ContentRecord } from '../values';

/**
 * Store for documents kept in the page tables: pages (`<pageId>`), and the
 * namespaced keys of globals (`global:<id>`) and form texts (`form:<id>`).
 * Page ids are kebab-case, so namespaced keys never collide with them.
 */
export const pageStore: DocumentStore = {
  async readRows(db, key, locales) {
    const rows = await db
      .select()
      .from(pageContent)
      .where(
        and(eq(pageContent.pageId, key), inArray(pageContent.locale, [SHARED_LOCALE, ...locales])),
      );
    return toDocumentRows(rows, SHARED_LOCALE);
  },

  async readSeo(db, key, locale) {
    const [row] = await db
      .select({ data: pageSeo.data, version: pageSeo.version })
      .from(pageSeo)
      .where(and(eq(pageSeo.pageId, key), eq(pageSeo.locale, locale)));
    return row ?? null;
  },

  async writeContent(db, key, locale, data, expected, { userId, now }) {
    if (expected === 0) {
      const inserted = await db
        .insert(pageContent)
        .values({ pageId: key, locale, data, version: 1, updatedBy: userId, updatedAt: now })
        .onConflictDoNothing()
        .returning({ version: pageContent.version });
      return inserted[0]?.version ?? null;
    }
    const [updated] = await db
      .update(pageContent)
      .set({ data, version: sql`${pageContent.version} + 1`, updatedBy: userId, updatedAt: now })
      .where(
        and(
          eq(pageContent.pageId, key),
          eq(pageContent.locale, locale),
          eq(pageContent.version, expected),
        ),
      )
      .returning({ version: pageContent.version });
    return updated?.version ?? null;
  },

  async writeSeo(db, key, locale, seo, expected, { userId, now }) {
    const data = { ...seo };
    if (expected === 0) {
      const inserted = await db
        .insert(pageSeo)
        .values({ pageId: key, locale, data, version: 1, updatedBy: userId, updatedAt: now })
        .onConflictDoNothing()
        .returning({ version: pageSeo.version });
      return inserted[0]?.version ?? null;
    }
    const [updated] = await db
      .update(pageSeo)
      .set({ data, version: sql`${pageSeo.version} + 1`, updatedBy: userId, updatedAt: now })
      .where(
        and(eq(pageSeo.pageId, key), eq(pageSeo.locale, locale), eq(pageSeo.version, expected)),
      )
      .returning({ version: pageSeo.version });
    return updated?.version ?? null;
  },

  async addRevision(db, key, locale, snapshot, author) {
    await db.insert(pageRevisions).values({
      pageId: key,
      locale,
      snapshot,
      authorId: author.id,
      authorName: author.name,
    });
  },

  async pruneRevisions(db, key, locale, keep) {
    const newest = await db
      .select({ id: pageRevisions.id })
      .from(pageRevisions)
      .where(and(eq(pageRevisions.pageId, key), eq(pageRevisions.locale, locale)))
      .orderBy(desc(pageRevisions.createdAt))
      .limit(keep);
    await db.delete(pageRevisions).where(
      and(
        eq(pageRevisions.pageId, key),
        eq(pageRevisions.locale, locale),
        notInArray(
          pageRevisions.id,
          newest.map((row) => row.id),
        ),
      ),
    );
  },

  async listRevisions(db, key, locale) {
    const rows = await db
      .select({
        id: pageRevisions.id,
        createdAt: pageRevisions.createdAt,
        authorName: pageRevisions.authorName,
      })
      .from(pageRevisions)
      .where(and(eq(pageRevisions.pageId, key), eq(pageRevisions.locale, locale)))
      .orderBy(desc(pageRevisions.createdAt));
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  },

  async readRevision(db, revisionId) {
    const [row] = await db.select().from(pageRevisions).where(eq(pageRevisions.id, revisionId));
    return row ? { key: row.pageId, locale: row.locale, snapshot: row.snapshot } : null;
  },

  async readContentRows(db, keys, locales) {
    if (keys.length === 0) return [];
    const rows = await db
      .select({ key: pageContent.pageId, locale: pageContent.locale, data: pageContent.data })
      .from(pageContent)
      .where(
        and(
          inArray(pageContent.pageId, [...keys]),
          inArray(pageContent.locale, [SHARED_LOCALE, ...locales]),
        ),
      );
    return rows.map((row) => ({ ...row, data: row.data as ContentRecord }));
  },
};
