import 'server-only';

import { and, count, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';

import { registry } from '@/content';
import { ActionErrorCode } from '@/core/actions/result';
import { GuardError } from '@/core/actions/run';
import { media, pageContent, pageRevisions, pageSeo, SHARED_LOCALE } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { parsePageSeo, type PageSeo } from '@/core/seo/page-seo';

import type { EditorVersions } from './editor-types';
import { collectMediaIds, type ContentRecord, type JsonRecord, splitContent } from './values';

export const MAX_REVISIONS = 20;

export const CONFLICT_MESSAGE =
  'Someone else saved this page since you opened it. Reload to see their changes (your edits will be lost), or copy them first.';

export interface SaveInput {
  readonly pageId: string;
  readonly locale: string;
  /** Full, validated content for the locale (shared + localized values). */
  readonly content: ContentRecord;
  readonly seo: PageSeo;
  readonly versions: EditorVersions;
  readonly author: { readonly id: string; readonly name: string };
}

export interface SaveResult {
  readonly versions: EditorVersions;
  readonly changed: {
    readonly shared: boolean;
    readonly localized: boolean;
    readonly seo: boolean;
  };
}

/** Deterministic JSON for change detection (jsonb doesn't preserve key order). */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as JsonRecord)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Keeps stored keys the schema no longer knows (orphans are reported, never deleted). */
function preserveOrphans(next: ContentRecord, stored: ContentRecord | undefined): ContentRecord {
  const result: ContentRecord = { ...(stored ?? {}) };
  for (const [sectionId, values] of Object.entries(next)) {
    result[sectionId] = { ...(stored?.[sectionId] ?? {}), ...values };
  }
  return result;
}

/**
 * Saves a page locale with optimistic concurrency: each changed row is written
 * only if its version still matches what the editor loaded; otherwise the whole
 * save is rolled back with a conflict error. Records a revision and keeps the
 * last MAX_REVISIONS per (page, locale).
 */
export async function savePageContent(db: Database, input: SaveInput): Promise<SaveResult> {
  const page = registry.byId(input.pageId);
  if (!page) throw new GuardError('Unknown page.', ActionErrorCode.NotFound);

  await assertMediaExists(db, [
    ...collectMediaIds(page, input.content),
    ...(input.seo.ogImageId ? [input.seo.ogImageId] : []),
  ]);
  const split = splitContent(page, input.content);

  return db.transaction(async (tx) => {
    const contentRows = await tx
      .select()
      .from(pageContent)
      .where(
        and(
          eq(pageContent.pageId, input.pageId),
          inArray(pageContent.locale, [SHARED_LOCALE, input.locale]),
        ),
      );
    const storedShared = contentRows.find((row) => row.locale === SHARED_LOCALE);
    const storedLocalized = contentRows.find((row) => row.locale === input.locale);
    const [storedSeo] = await tx
      .select()
      .from(pageSeo)
      .where(and(eq(pageSeo.pageId, input.pageId), eq(pageSeo.locale, input.locale)));

    const nextShared = preserveOrphans(
      split.shared,
      storedShared?.data as ContentRecord | undefined,
    );
    const nextLocalized = preserveOrphans(
      split.localized,
      storedLocalized?.data as ContentRecord | undefined,
    );
    const changed = {
      shared: stableStringify(nextShared) !== stableStringify(storedShared?.data ?? {}),
      localized: stableStringify(nextLocalized) !== stableStringify(storedLocalized?.data ?? {}),
      seo: stableStringify(input.seo) !== stableStringify(parsePageSeo(storedSeo?.data)),
    };

    const versions = { ...input.versions };
    const now = new Date();
    if (changed.shared) {
      versions.shared = await writeContentRow(
        tx,
        input.pageId,
        SHARED_LOCALE,
        nextShared,
        input.versions.shared,
        input.author.id,
        now,
      );
    }
    if (changed.localized) {
      versions.localized = await writeContentRow(
        tx,
        input.pageId,
        input.locale,
        nextLocalized,
        input.versions.localized,
        input.author.id,
        now,
      );
    }
    if (changed.seo) {
      versions.seo = await writeSeoRow(
        tx,
        input.pageId,
        input.locale,
        input.seo,
        input.versions.seo,
        input.author.id,
        now,
      );
    }

    if (changed.shared || changed.localized || changed.seo) {
      await tx.insert(pageRevisions).values({
        pageId: input.pageId,
        locale: input.locale,
        snapshot: { content: nextLocalized, shared: nextShared, seo: { ...input.seo } },
        authorId: input.author.id,
        authorName: input.author.name,
      });
      await pruneRevisions(tx, input.pageId, input.locale);
    }
    return { versions, changed };
  });
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

async function writeContentRow(
  tx: Tx,
  pageId: string,
  locale: string,
  data: ContentRecord,
  expected: number,
  userId: string,
  now: Date,
): Promise<number> {
  if (expected === 0) {
    const inserted = await tx
      .insert(pageContent)
      .values({ pageId, locale, data, version: 1, updatedBy: userId, updatedAt: now })
      .onConflictDoNothing()
      .returning({ version: pageContent.version });
    if (inserted.length === 0) throw new GuardError(CONFLICT_MESSAGE, ActionErrorCode.Conflict);
    return 1;
  }
  const updated = await tx
    .update(pageContent)
    .set({ data, version: sql`${pageContent.version} + 1`, updatedBy: userId, updatedAt: now })
    .where(
      and(
        eq(pageContent.pageId, pageId),
        eq(pageContent.locale, locale),
        eq(pageContent.version, expected),
      ),
    )
    .returning({ version: pageContent.version });
  if (!updated[0]) throw new GuardError(CONFLICT_MESSAGE, ActionErrorCode.Conflict);
  return updated[0].version;
}

async function writeSeoRow(
  tx: Tx,
  pageId: string,
  locale: string,
  data: PageSeo,
  expected: number,
  userId: string,
  now: Date,
): Promise<number> {
  const record = { ...data } as JsonRecord;
  if (expected === 0) {
    const inserted = await tx
      .insert(pageSeo)
      .values({ pageId, locale, data: record, version: 1, updatedBy: userId, updatedAt: now })
      .onConflictDoNothing()
      .returning({ version: pageSeo.version });
    if (inserted.length === 0) throw new GuardError(CONFLICT_MESSAGE, ActionErrorCode.Conflict);
    return 1;
  }
  const updated = await tx
    .update(pageSeo)
    .set({ data: record, version: sql`${pageSeo.version} + 1`, updatedBy: userId, updatedAt: now })
    .where(
      and(eq(pageSeo.pageId, pageId), eq(pageSeo.locale, locale), eq(pageSeo.version, expected)),
    )
    .returning({ version: pageSeo.version });
  if (!updated[0]) throw new GuardError(CONFLICT_MESSAGE, ActionErrorCode.Conflict);
  return updated[0].version;
}

async function pruneRevisions(tx: Tx, pageId: string, locale: string): Promise<void> {
  const keep = await tx
    .select({ id: pageRevisions.id })
    .from(pageRevisions)
    .where(and(eq(pageRevisions.pageId, pageId), eq(pageRevisions.locale, locale)))
    .orderBy(desc(pageRevisions.createdAt))
    .limit(MAX_REVISIONS);
  await tx.delete(pageRevisions).where(
    and(
      eq(pageRevisions.pageId, pageId),
      eq(pageRevisions.locale, locale),
      notInArray(
        pageRevisions.id,
        keep.map((row) => row.id),
      ),
    ),
  );
}

async function assertMediaExists(db: Database, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const [row] = await db.select({ value: count() }).from(media).where(inArray(media.id, unique));
  if ((row?.value ?? 0) !== unique.length) {
    throw new GuardError(
      'An image could not be found. Upload it again.',
      ActionErrorCode.Validation,
    );
  }
}
