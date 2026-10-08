import 'server-only';

import { and, desc, eq, inArray } from 'drizzle-orm';

import { registry } from '@/content';
import { getDb } from '@/core/db/client';
import { pageContent, pageRevisions, pageSeo, SHARED_LOCALE } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { localizedPath } from '@/core/i18n/routing';
import { loadMedia, seedAssetIds } from '@/core/media/resolve';
import { parsePageSeo } from '@/core/seo/page-seo';
import { readSiteSettings } from '@/core/settings/repository';

import { type AnyPage, seoDefaultsFor } from './define';
import type { EditorData, LocaleStatus, MediaPreview, RevisionSummary } from './editor-types';
import { readPageRows, storedRowsFor } from './repository';
import { pageContentSchema, parseStoredValue } from './validation';
import {
  collectMediaIds,
  type ContentRecord,
  mergeWithoutFallback,
  resolveWithFallback,
  seedAssets,
  seedToStored,
} from './values';

export function editorPage(page: AnyPage, locale: string) {
  return {
    id: page.id,
    label: page.label,
    path: page.path,
    sections: page.sections,
    seoDefaults: seoDefaultsFor(page, locale),
  };
}

/** Everything the editor needs for one page in one locale (uncached: always fresh). */
export async function loadEditorData(pageId: string, locale: string): Promise<EditorData | null> {
  const page = registry.byId(pageId);
  if (!page) return null;
  const db = await getDb();
  const { general } = await readSiteSettings(db);
  const defaultLocale = general.defaultLocale;

  const [rows, assetIds, seoRow] = await Promise.all([
    readPageRows(db, pageId, [locale, defaultLocale]),
    seedAssetIds(db, seedAssets(page)),
    db
      .select()
      .from(pageSeo)
      .where(and(eq(pageSeo.pageId, pageId), eq(pageSeo.locale, locale))),
  ]);
  const seed = page.seed as Partial<Record<string, ContentRecord>> | undefined;
  const primary = storedRowsFor(rows, locale);
  const content = resolveWithFallback(page, {
    primary,
    defaultLocale: locale === defaultLocale ? undefined : storedRowsFor(rows, defaultLocale),
    seeds: [
      seedToStored(page, seed?.[locale], assetIds),
      seedToStored(page, seed?.[defaultLocale], assetIds),
    ],
  });

  const inherited: string[] = [];
  for (const section of page.sections) {
    for (const [key, field] of Object.entries(section.fields)) {
      const record = field.localized ? primary.localized : primary.shared;
      if (parseStoredValue(field, record?.[section.id]?.[key]) === undefined)
        inherited.push(`${section.id}.${key}`);
    }
  }

  const seo = parsePageSeo(seoRow[0]?.data);
  const mediaIds = [...collectMediaIds(page, content), ...(seo.ogImageId ? [seo.ogImageId] : [])];
  const mediaInfo = await loadMedia(db, mediaIds);
  const media: Record<string, MediaPreview> = {};
  for (const [id, info] of mediaInfo)
    media[id] = { id, src: info.src, width: info.width, height: info.height };

  return {
    page: editorPage(page, locale),
    locale,
    defaultLocale,
    content,
    inherited,
    seo,
    versions: {
      shared: rows.versions.get(SHARED_LOCALE) ?? 0,
      localized: rows.versions.get(locale) ?? 0,
      seo: seoRow[0]?.version ?? 0,
    },
    media,
    publicUrl: localizedPath(page.path, locale, defaultLocale),
  };
}

/** Per-locale completeness of every page (required fields filled, without fallbacks). */
export async function loadPageStatuses(
  db: Database,
  locales: readonly string[],
): Promise<Record<string, Record<string, LocaleStatus>>> {
  const rows = await db
    .select({ pageId: pageContent.pageId, locale: pageContent.locale, data: pageContent.data })
    .from(pageContent)
    .where(inArray(pageContent.locale, [SHARED_LOCALE, ...locales]));
  const byPage = new Map<string, Map<string, ContentRecord>>();
  for (const row of rows) {
    const map = byPage.get(row.pageId) ?? new Map<string, ContentRecord>();
    map.set(row.locale, row.data as ContentRecord);
    byPage.set(row.pageId, map);
  }

  const result: Record<string, Record<string, LocaleStatus>> = {};
  for (const page of registry.pages) {
    const stored = byPage.get(page.id);
    const schema = pageContentSchema(page);
    const statuses: Record<string, LocaleStatus> = {};
    for (const locale of locales) {
      const localized = stored?.get(locale);
      if (!localized) {
        statuses[locale] = 'missing';
        continue;
      }
      const merged = mergeWithoutFallback(page, { shared: stored?.get(SHARED_LOCALE), localized });
      statuses[locale] = schema.safeParse(merged).success ? 'complete' : 'incomplete';
    }
    result[page.id] = statuses;
  }
  return result;
}

export async function listRevisions(
  db: Database,
  pageId: string,
  locale: string,
): Promise<RevisionSummary[]> {
  const rows = await db
    .select({
      id: pageRevisions.id,
      createdAt: pageRevisions.createdAt,
      authorName: pageRevisions.authorName,
    })
    .from(pageRevisions)
    .where(and(eq(pageRevisions.pageId, pageId), eq(pageRevisions.locale, locale)))
    .orderBy(desc(pageRevisions.createdAt));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
