import type { RevisionSnapshot } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import type { PageSeo } from '@/core/seo/page-seo';

import type { RevisionSummary } from './editor-types';
import type { ContentRecord, StoredRows } from './values';

/**
 * Storage binding for editable documents (pages, globals, form texts, collection
 * items). The save engine (`save.ts`), the editor loader and revisions are
 * written once against this interface; each store only binds its tables.
 * Every method also accepts a transaction (a Drizzle transaction is a `Database`).
 */

/** Content rows of one document: shared + localized values with their versions. */
export interface DocumentRows {
  readonly shared: ContentRecord | undefined;
  readonly byLocale: ReadonlyMap<string, ContentRecord>;
  /** Row versions keyed by locale (`_shared` included); missing → 0. */
  readonly versions: ReadonlyMap<string, number>;
  readonly updatedAt: Date | null;
}

export interface StoredSeo {
  readonly data: unknown;
  readonly version: number;
}

export interface RevisionRecord {
  readonly key: string;
  readonly locale: string;
  readonly snapshot: RevisionSnapshot;
}

export interface WriteContext {
  /** Null for system writes (content:sync). */
  readonly userId: string | null;
  readonly now: Date;
}

/** Content row of any document (for completeness and last-modified queries). */
export interface ContentRowSummary {
  readonly key: string;
  readonly locale: string;
  readonly data: ContentRecord;
}

export interface DocumentStore {
  readRows(db: Database, key: string, locales: readonly string[]): Promise<DocumentRows>;
  readSeo(db: Database, key: string, locale: string): Promise<StoredSeo | null>;
  /** Inserts (expected 0) or updates the row if its version matches; returns the new version or null on conflict. */
  writeContent(
    db: Database,
    key: string,
    locale: string,
    data: ContentRecord,
    expected: number,
    context: WriteContext,
  ): Promise<number | null>;
  writeSeo(
    db: Database,
    key: string,
    locale: string,
    data: PageSeo,
    expected: number,
    context: WriteContext,
  ): Promise<number | null>;
  addRevision(
    db: Database,
    key: string,
    locale: string,
    snapshot: RevisionSnapshot,
    author: { readonly id: string; readonly name: string },
  ): Promise<void>;
  /** Deletes all but the newest `keep` revisions of (key, locale). */
  pruneRevisions(db: Database, key: string, locale: string, keep: number): Promise<void>;
  listRevisions(db: Database, key: string, locale: string): Promise<RevisionSummary[]>;
  readRevision(db: Database, revisionId: string): Promise<RevisionRecord | null>;
  /** Content rows of the given documents in the given locales (plus `_shared`). */
  readContentRows(
    db: Database,
    keys: readonly string[],
    locales: readonly string[],
  ): Promise<ContentRowSummary[]>;
}

export function storedRowsFor(rows: DocumentRows, locale: string): StoredRows {
  return { shared: rows.shared, localized: rows.byLocale.get(locale) };
}

/** Groups raw rows into shared + per-locale records. */
export function toDocumentRows(
  rows: ReadonlyArray<{ locale: string; data: unknown; version: number; updatedAt: Date }>,
  sharedLocale: string,
): DocumentRows {
  const byLocale = new Map<string, ContentRecord>();
  const versions = new Map<string, number>();
  let shared: ContentRecord | undefined;
  let updatedAt: Date | null = null;
  for (const row of rows) {
    versions.set(row.locale, row.version);
    if (!updatedAt || row.updatedAt > updatedAt) updatedAt = row.updatedAt;
    if (row.locale === sharedLocale) shared = row.data as ContentRecord;
    else byLocale.set(row.locale, row.data as ContentRecord);
  }
  return { shared, byLocale, versions, updatedAt };
}
