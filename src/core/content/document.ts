import 'server-only';

import { projectConfig } from '@project/config';

import { registry } from '@/content';
import { CacheTag } from '@/core/cache/tags';
import { selectedLocales } from '@/core/i18n/language-state';
import { readSiteSettings } from '@/core/settings/repository';
import { findItem, itemText, readItemRows } from '@/core/collections/repository';
import { getDb } from '@/core/db/client';
import { localizedPath } from '@/core/i18n/routing';

import { collectionItemPath, CollectionItemStatus, itemSeedSchema } from './collection';
import { type ContentSchema, type SectionList, seoDefaultsFor } from './define';
import { ownSchema, sharedKey } from './shared-section';
import { globalKey } from './global';
import { formKey } from '@/core/forms/define';
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
  /** What this document stores (a page's own sections; shared sections are stored once). */
  readonly schema: ContentSchema;
  /**
   * Schema whose seed holds this document's code defaults ("Reset to code
   * defaults"); null for collection items people created (they have no seed).
   */
  readonly codeSchema: ContentSchema | null;
  /** Sections shown in the editor, in site order (a page's own and shared sections). */
  readonly displaySections?: SectionList;
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
    schema: ownSchema(page),
    codeSchema: ownSchema(page),
    displaySections: page.sections,
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
  const { general } = await readSiteSettings(db);
  const rows = await readItemRows(db, item.id, selectedLocales(general));
  const { defaultLocale } = projectConfig;
  const text = (field: string | undefined, locale: string) =>
    itemText(collection, rows, field, locale, defaultLocale);
  const title = text(collection.titleField, defaultLocale);
  const published = item.status === CollectionItemStatus.Published;
  // Seed items keep their seed slug; items people created have no code defaults.
  const seed = collection.seed?.find((entry) => entry.slug === item.slug);
  return {
    target: { kind: DocumentKind.Item, collectionId, itemId },
    key: item.id,
    label: title || untitledItemLabel(collection.itemLabel),
    schema: collection.schema,
    codeSchema: seed ? itemSeedSchema(collection, seed) : null,
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

function globalDocument(id: string): ContentDocument | null {
  const global = contentRegistry.globalById(id);
  if (!global) return null;
  return {
    target: { kind: DocumentKind.Global, id },
    key: globalKey(global.id),
    label: global.label,
    schema: global,
    codeSchema: global,
    store: pageStore,
    hasSeo: false,
    seoDefaults: () => NO_SEO_DEFAULTS,
    publicPath: () => null,
    auditTarget: (locale) => `global:${global.id}:${locale}`,
    tagsToInvalidate: () => [CacheTag.global(global.id)],
  };
}

function formDocument(id: string): ContentDocument | null {
  const form = contentRegistry.formById(id);
  if (!form) return null;
  return {
    target: { kind: DocumentKind.Form, id },
    key: formKey(form.id),
    label: form.label,
    schema: form.texts,
    codeSchema: form.texts,
    store: pageStore,
    hasSeo: false,
    seoDefaults: () => NO_SEO_DEFAULTS,
    publicPath: () => null,
    auditTarget: (locale) => `form:${form.id}:${locale}`,
    tagsToInvalidate: () => [CacheTag.form(form.id)],
  };
}

function sharedDocument(id: string): ContentDocument | null {
  const shared = contentRegistry.sharedSectionById(id);
  if (!shared) return null;
  return {
    target: { kind: DocumentKind.Shared, id },
    key: sharedKey(shared.id),
    label: shared.label,
    schema: shared.schema,
    codeSchema: shared.schema,
    store: pageStore,
    hasSeo: false,
    seoDefaults: () => NO_SEO_DEFAULTS,
    publicPath: () => null,
    auditTarget: (locale) => `shared:${shared.id}:${locale}`,
    // Every page that uses it is tagged with the shared section (content loader).
    tagsToInvalidate: () => [CacheTag.shared(shared.id)],
  };
}

/** Resolves a target to its document, or null when it doesn't exist (any more). */
export async function resolveDocument(target: DocumentTarget): Promise<ContentDocument | null> {
  switch (target.kind) {
    case DocumentKind.Page:
      return pageDocument(target.id);
    case DocumentKind.Item:
      return itemDocument(target.collectionId, target.itemId);
    case DocumentKind.Global:
      return globalDocument(target.id);
    case DocumentKind.Form:
      return formDocument(target.id);
    case DocumentKind.Shared:
      return sharedDocument(target.id);
  }
}
