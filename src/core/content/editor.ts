import 'server-only';

import { registry } from '@/content';
import { getDb } from '@/core/db/client';
import { SHARED_LOCALE } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { loadMedia, seedAssetIds } from '@/core/media/resolve';
import { parsePageSeo } from '@/core/seo/page-seo';
import { readSiteSettings } from '@/core/settings/repository';

import type { ContentSchema } from './define';
import { type ContentDocument, resolveDocument } from './document';
import { DocumentKind, type DocumentTarget } from './document-target';
import type { EditorData, EditorSharedSection, LocaleStatus, MediaPreview } from './editor-types';
import { contentRegistry } from './project-registry';
import { sharedKey, sharedUses } from './shared-section';
import { type DocumentStore, storedRowsFor } from './store';
import { pageStore } from './stores/table-store';
import { pageContentSchema, parseStoredValue } from './validation';
import {
  collectMediaIds,
  type ContentRecord,
  mergeWithoutFallback,
  resolveWithFallback,
  seedAssets,
  seedToStored,
} from './values';

export function editorDocument(document: ContentDocument, locale: string, defaultLocale: string) {
  return {
    target: document.target,
    label: document.label,
    path: document.publicPath(defaultLocale, defaultLocale),
    sections: document.displaySections ?? document.schema.sections,
    hasSeo: document.hasSeo,
    seoDefaults: document.seoDefaults(locale),
  };
}

interface LoadedValues {
  readonly content: ContentRecord;
  /** `section.field` paths not saved for this locale yet. */
  readonly inherited: string[];
  readonly versions: { readonly shared: number; readonly localized: number };
}

/** Stored values of one document in a locale with the full fallback chain (editor view). */
async function loadValues(
  db: Database,
  schema: ContentSchema,
  store: DocumentStore,
  key: string,
  locale: string,
  defaultLocale: string,
): Promise<LoadedValues> {
  const [rows, assetIds] = await Promise.all([
    store.readRows(db, key, [locale, defaultLocale]),
    seedAssetIds(db, seedAssets(schema)),
  ]);
  const seed = schema.seed as Partial<Record<string, ContentRecord>> | undefined;
  const primary = storedRowsFor(rows, locale);
  const content = resolveWithFallback(schema, {
    primary,
    defaultLocale: locale === defaultLocale ? undefined : storedRowsFor(rows, defaultLocale),
    seeds: [
      seedToStored(schema, seed?.[locale], assetIds),
      seedToStored(schema, seed?.[defaultLocale], assetIds),
    ],
  });
  const inherited: string[] = [];
  for (const section of schema.sections) {
    for (const [fieldKey, field] of Object.entries(section.fields)) {
      const record = field.localized ? primary.localized : primary.shared;
      if (parseStoredValue(field, record?.[section.id]?.[fieldKey]) === undefined)
        inherited.push(`${section.id}.${fieldKey}`);
    }
  }
  return {
    content,
    inherited,
    versions: {
      shared: rows.versions.get(SHARED_LOCALE) ?? 0,
      localized: rows.versions.get(locale) ?? 0,
    },
  };
}

/** Pages that use a shared section (for "Also on …"). */
function usedOn(sharedId: string) {
  return contentRegistry
    .pagesUsingShared(sharedId)
    .map((page) => ({ id: page.id, label: page.label }));
}

/** Everything the editor needs for one document in one locale (uncached: always fresh). */
export async function loadEditorData(
  target: DocumentTarget,
  locale: string,
): Promise<EditorData | null> {
  const document = await resolveDocument(target);
  if (!document) return null;
  const { schema, store, key } = document;
  const db = await getDb();
  const { general } = await readSiteSettings(db);
  const defaultLocale = general.defaultLocale;
  // Shared sections placed in this page (stored under their own keys).
  const uses = sharedUses({ sections: document.displaySections ?? [] }).flatMap((use) => {
    const shared = contentRegistry.sharedSectionById(use.sharedId);
    return shared ? [shared] : [];
  });

  const [own, seoRow, ...sharedValues] = await Promise.all([
    loadValues(db, schema, store, key, locale, defaultLocale),
    document.hasSeo ? store.readSeo(db, key, locale) : Promise.resolve(null),
    ...uses.map((shared) =>
      loadValues(db, shared.schema, pageStore, sharedKey(shared.id), locale, defaultLocale),
    ),
  ]);
  const content: ContentRecord = { ...own.content };
  const inherited = [...own.inherited];
  const shared: EditorSharedSection[] = [];
  uses.forEach((definition, index) => {
    const values = sharedValues[index];
    if (!values) return;
    Object.assign(content, values.content);
    inherited.push(...values.inherited);
    shared.push({
      id: definition.id,
      label: definition.label,
      versions: { ...values.versions, seo: 0 },
      usedOn: usedOn(definition.id),
    });
  });
  if (document.target.kind === DocumentKind.Shared) {
    const definition = contentRegistry.sharedSectionById(document.target.id);
    if (definition) {
      shared.push({
        id: definition.id,
        label: definition.label,
        versions: { ...own.versions, seo: 0 },
        usedOn: usedOn(definition.id),
      });
    }
  }

  const seo = parsePageSeo(seoRow?.data);
  const allSections = { sections: document.displaySections ?? schema.sections };
  const mediaIds = [
    ...collectMediaIds(allSections, content),
    ...(seo.ogImageId ? [seo.ogImageId] : []),
  ];
  const mediaInfo = await loadMedia(db, mediaIds);
  const media: Record<string, MediaPreview> = {};
  for (const [id, info] of mediaInfo)
    media[id] = { id, src: info.src, width: info.width, height: info.height };

  return {
    document: editorDocument(document, locale, defaultLocale),
    locale,
    defaultLocale,
    content,
    inherited,
    seo,
    versions: { ...own.versions, seo: seoRow?.version ?? 0 },
    media,
    publicUrl: document.publicPath(locale, defaultLocale),
    shared,
  };
}

/**
 * Per-locale completeness of documents (required fields filled, without
 * fallbacks), keyed by document key. Documents must share one store.
 */
export async function loadDocumentStatuses(
  db: Database,
  documents: readonly ContentDocument[],
  locales: readonly string[],
): Promise<Record<string, Record<string, LocaleStatus>>> {
  const [first] = documents;
  if (!first) return {};
  const rows = await first.store.readContentRows(
    db,
    documents.map((document) => document.key),
    locales,
  );
  const byKey = new Map<string, Map<string, ContentRecord>>();
  for (const row of rows) {
    const map = byKey.get(row.key) ?? new Map<string, ContentRecord>();
    map.set(row.locale, row.data);
    byKey.set(row.key, map);
  }

  const result: Record<string, Record<string, LocaleStatus>> = {};
  for (const document of documents) {
    result[document.key] = localeStatuses(document.schema, byKey.get(document.key), locales);
  }
  return result;
}

/** Completeness per locale of one document's stored rows (`_shared` + locales). */
export function localeStatuses(
  schema: ContentSchema,
  stored: ReadonlyMap<string, ContentRecord> | undefined,
  locales: readonly string[],
): Record<string, LocaleStatus> {
  const validator = pageContentSchema(schema);
  const statuses: Record<string, LocaleStatus> = {};
  for (const locale of locales) {
    const localized = stored?.get(locale);
    if (!localized) {
      statuses[locale] = 'missing';
      continue;
    }
    const merged = mergeWithoutFallback(schema, { shared: stored?.get(SHARED_LOCALE), localized });
    statuses[locale] = validator.safeParse(merged).success ? 'complete' : 'incomplete';
  }
  return statuses;
}

/** Completeness of every registered page (Pages tree). */
export async function loadPageStatuses(
  db: Database,
  locales: readonly string[],
): Promise<Record<string, Record<string, LocaleStatus>>> {
  const documents = await Promise.all(
    registry.pages.map((page) => resolveDocument({ kind: DocumentKind.Page, id: page.id })),
  );
  return loadDocumentStatuses(
    db,
    documents.filter((document): document is ContentDocument => document !== null),
    locales,
  );
}
