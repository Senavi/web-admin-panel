import 'server-only';

import { projectConfig } from '@project/config';

import { registry } from '@/content';
import { CacheTag } from '@/core/cache/tags';
import { findItem, itemText, readItemRows } from '@/core/collections/repository';
import { getDb } from '@/core/db/client';
import { localizedPath } from '@/core/i18n/routing';

import { collectionItemPath, CollectionItemStatus } from './collection';
import { type ContentSchema, seoDefaultsFor } from './define';
import { contentRegistry } from './project-registry';
import { DocumentKind, type DocumentTarget } from './document-target';
import type { DocumentStore } from './store';
import { collectionItemStore, pageStore } from './stores/table-store';

/**
 * An editable document: something with sections, stored per locale with
 * revisions and optimistic concurrency. Pages, globals, form texts and
 * collection items are all documents; the editor, save engine and revision
 * actions work on `ContentDocument` and never on a specific kind.
 */

/** Which rows a save changed (drives cache invalidation). */
export interface ChangedRows {
  readonly shared: boolean;
  readonly localized: boolean;
  readonly seo: boolean;
}

export interface ContentDocument {
  readonly target: DocumentTarget;
  /** Storage key in its store (`page_id` column for page-table documents). */
  readonly key: string;
  readonly label: string;
  readonly schema: ContentSchema;
  readonly store: DocumentStore;
  readonly hasSeo: boolean;
  seoDefaults(locale: string): { title: string; description: string };
  /** Public URL path for a locale, or null when the document has no page of its own. */
  publicPath(locale: string, defaultLocale: string): string | null;
  /** Audit-log target for a save in a locale. */
  auditTarget(locale: string): string;
  /** Cache tags to invalidate after a save. */
  tagsToInvalidate(locale: string, changed: ChangedRows): string[];
}

/** SEO defaults of documents without SEO (globals, form texts). */
export const NO_SEO_DEFAULTS = { title: '', description: '' } as const;

function pageDocument(id: string): ContentDocument | null {
  const page = registry.byId(id);
  if (!page) return null;
  return {
    target: { kind: DocumentKind.Page, id },
    key: page.id,
    label: page.label,
    schema: page,
    store: pageStore,
    hasSeo: true,
    seoDefaults: (locale) => seoDefaultsFor(page, locale),
    publicPath: (locale, defaultLocale) => localizedPath(page.path, locale, defaultLocale),
    auditTarget: (locale) => `page:${page.id}:${locale}`,
    tagsToInvalidate(locale, changed) {
      const tags: string[] = [];
      if (changed.shared) tags.push(CacheTag.content(page.id));
      if (changed.localized || changed.seo) tags.push(CacheTag.contentLocale(page.id, locale));
      if (changed.seo) tags.push(CacheTag.Sitemap);
      return tags;
    },
  };
}

/** Label of an item without a title yet, e.g. "Untitled post". */
export function untitledItemLabel(itemLabel: string): string {
  return `Untitled ${itemLabel.toLowerCase()}`;
}

async function itemDocument(collectionId: string, itemId: string): Promise<ContentDocument | null> {
  const collection = contentRegistry.collectionById(collectionId);
  if (!collection) return null;
  const db = await getDb();
  const item = await findItem(db, collectionId, itemId);
  if (!item) return null;
  const rows = await readItemRows(db, item.id, projectConfig.localeCodes);
  const { defaultLocale } = projectConfig;
  const text = (field: string | undefined, locale: string) =>
    itemText(collection, rows, field, locale, defaultLocale);
  const title = text(collection.titleField, defaultLocale);
  const published = item.status === CollectionItemStatus.Published;
  return {
    target: { kind: DocumentKind.Item, collectionId, itemId },
    key: item.id,
    label: title || untitledItemLabel(collection.itemLabel),
    schema: collection.schema,
    store: collectionItemStore,
    hasSeo: true,
    seoDefaults: (locale) => ({
      title: text(collection.titleField, locale),
      description: text(collection.summaryField, locale),
    }),
    publicPath: (locale, siteDefault) =>
      published
        ? localizedPath(collectionItemPath(collection, item.slug), locale, siteDefault)
        : null,
    auditTarget: () => `item:${collection.id}:${item.id}`,
    tagsToInvalidate: () => [
      CacheTag.collectionItem(collection.id, item.slug),
      CacheTag.collectionList(collection.id),
      CacheTag.Sitemap,
    ],
  };
}

/** Resolves a target to its document, or null when it doesn't exist (any more). */
export async function resolveDocument(target: DocumentTarget): Promise<ContentDocument | null> {
  switch (target.kind) {
    case DocumentKind.Page:
      return pageDocument(target.id);
    case DocumentKind.Item:
      return itemDocument(target.collectionId, target.itemId);
  }
}
