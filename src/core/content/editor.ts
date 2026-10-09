import 'server-only';

import { registry } from '@/content';
import { getDb } from '@/core/db/client';
import { SHARED_LOCALE } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { loadMedia, seedAssetIds } from '@/core/media/resolve';
import { parsePageSeo } from '@/core/seo/page-seo';
import { readSiteSettings } from '@/core/settings/repository';

import { type ContentDocument, resolveDocument } from './document';
import { DocumentKind, type DocumentTarget } from './document-target';
import type { EditorData, LocaleStatus, MediaPreview } from './editor-types';
import { storedRowsFor } from './store';
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
    sections: document.schema.sections,
    hasSeo: document.hasSeo,
    seoDefaults: document.seoDefaults(locale),
  };
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

  const [rows, assetIds, seoRow] = await Promise.all([
    store.readRows(db, key, [locale, defaultLocale]),
    seedAssetIds(db, seedAssets(schema)),
    document.hasSeo ? store.readSeo(db, key, locale) : Promise.resolve(null),
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

  const seo = parsePageSeo(seoRow?.data);
  const mediaIds = [...collectMediaIds(schema, content), ...(seo.ogImageId ? [seo.ogImageId] : [])];
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
    versions: {
      shared: rows.versions.get(SHARED_LOCALE) ?? 0,
      localized: rows.versions.get(locale) ?? 0,
      seo: seoRow?.version ?? 0,
    },
    media,
    publicUrl: document.publicPath(locale, defaultLocale),
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
    const stored = byKey.get(document.key);
    const schema = pageContentSchema(document.schema);
    const statuses: Record<string, LocaleStatus> = {};
    for (const locale of locales) {
      const localized = stored?.get(locale);
      if (!localized) {
        statuses[locale] = 'missing';
        continue;
      }
      const merged = mergeWithoutFallback(document.schema, {
        shared: stored?.get(SHARED_LOCALE),
        localized,
      });
      statuses[locale] = schema.safeParse(merged).success ? 'complete' : 'incomplete';
    }
    result[document.key] = statuses;
  }
  return result;
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
