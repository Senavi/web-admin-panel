import 'server-only';

import { registry } from '@/content';
import { CacheTag } from '@/core/cache/tags';
import { localizedPath } from '@/core/i18n/routing';

import { type ContentSchema, seoDefaultsFor } from './define';
import { DocumentKind, type DocumentTarget } from './document-target';
import type { DocumentStore } from './store';
import { pageStore } from './stores/page-store';

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

/** Resolves a target to its document, or null when it doesn't exist (any more). */
export async function resolveDocument(target: DocumentTarget): Promise<ContentDocument | null> {
  switch (target.kind) {
    case DocumentKind.Page:
      return pageDocument(target.id);
  }
}
