import 'server-only';

import { count, inArray } from 'drizzle-orm';

import { ActionErrorCode } from '@/core/actions/result';
import { GuardError } from '@/core/actions/run';
import { media, SHARED_LOCALE } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { parsePageSeo, type PageSeo } from '@/core/seo/page-seo';

import { type ChangedRows, type ContentDocument, resolveDocument } from './document';
import { DocumentKind } from './document-target';
import type { EditorVersions } from './editor-types';
import { collectMediaIds, type ContentRecord, type JsonRecord, splitContent } from './values';

export const MAX_REVISIONS = 20;

export const CONFLICT_MESSAGE =
  'Someone else saved this since you opened it. Reload to see their changes (your edits will be lost), or copy them first.';

export interface SaveDocumentInput {
  readonly locale: string;
  /** Full, validated content for the locale (shared + localized values). */
  readonly content: ContentRecord;
  readonly seo: PageSeo;
  readonly versions: EditorVersions;
  readonly author: { readonly id: string; readonly name: string };
}

export interface SaveInput extends SaveDocumentInput {
  readonly pageId: string;
}

export interface SaveResult {
  readonly versions: EditorVersions;
  readonly changed: ChangedRows;
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

/** Saves a page locale (see `saveDocument`). */
export async function savePageContent(db: Database, input: SaveInput): Promise<SaveResult> {
  const document = await resolveDocument({ kind: DocumentKind.Page, id: input.pageId });
  if (!document) throw new GuardError('Unknown page.', ActionErrorCode.NotFound);
  return saveDocument(db, document, input);
}

/**
 * Saves one locale of a document with optimistic concurrency: each changed row
 * is written only if its version still matches what the editor loaded;
 * otherwise the whole save is rolled back with a conflict error. Records a
 * revision and keeps the last MAX_REVISIONS per (document, locale).
 * `extra` runs inside the same transaction (e.g. collection item metadata).
 */
export async function saveDocument(
  db: Database,
  document: ContentDocument,
  input: SaveDocumentInput,
  extra?: (tx: Database) => Promise<boolean>,
): Promise<SaveResult> {
  const { schema, store, key } = document;
  await assertMediaExists(db, [
    ...collectMediaIds(schema, input.content),
    ...(input.seo.ogImageId ? [input.seo.ogImageId] : []),
  ]);
  const split = splitContent(schema, input.content);

  return db.transaction(async (tx) => {
    // Sequential: one connection per transaction.
    const rows = await store.readRows(tx, key, [input.locale]);
    const storedSeo = document.hasSeo ? await store.readSeo(tx, key, input.locale) : null;
    const nextShared = preserveOrphans(split.shared, rows.shared);
    const nextLocalized = preserveOrphans(split.localized, rows.byLocale.get(input.locale));
    const extraChanged = extra ? await extra(tx) : false;
    const changed = {
      shared: stableStringify(nextShared) !== stableStringify(rows.shared ?? {}),
      localized:
        stableStringify(nextLocalized) !== stableStringify(rows.byLocale.get(input.locale) ?? {}),
      seo:
        document.hasSeo &&
        stableStringify(input.seo) !== stableStringify(parsePageSeo(storedSeo?.data)),
    };

    const versions = { ...input.versions };
    const context = { userId: input.author.id, now: new Date() };
    const write = async (version: Promise<number | null>) => {
      const next = await version;
      if (next === null) throw new GuardError(CONFLICT_MESSAGE, ActionErrorCode.Conflict);
      return next;
    };
    if (changed.shared) {
      versions.shared = await write(
        store.writeContent(tx, key, SHARED_LOCALE, nextShared, input.versions.shared, context),
      );
    }
    if (changed.localized) {
      versions.localized = await write(
        store.writeContent(tx, key, input.locale, nextLocalized, input.versions.localized, context),
      );
    }
    if (changed.seo) {
      versions.seo = await write(
        store.writeSeo(tx, key, input.locale, input.seo, input.versions.seo, context),
      );
    }

    if (changed.shared || changed.localized || changed.seo || extraChanged) {
      await store.addRevision(
        tx,
        key,
        input.locale,
        { content: nextLocalized, shared: nextShared, seo: { ...input.seo } },
        input.author,
      );
      await store.pruneRevisions(tx, key, input.locale, MAX_REVISIONS);
    }
    return { versions, changed };
  });
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
