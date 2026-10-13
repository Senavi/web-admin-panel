import 'server-only';

import { and, eq, max } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';

import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';
import { pageContent, pageSeo } from '@/core/db/schema';
import { isPreviewMode } from '@/core/preview/mode';

import { type PageSeo, parsePageSeo } from './page-seo';

/** SEO overrides of a page in a locale (cached with the page's content tags). */
export async function getPageSeo(pageId: string, locale: string): Promise<PageSeo> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.content(pageId), CacheTag.contentLocale(pageId, locale));
  if (isPreviewMode()) return parsePageSeo(undefined);
  const [row] = await (
    await getDb()
  )
    .select({ data: pageSeo.data })
    .from(pageSeo)
    .where(and(eq(pageSeo.pageId, pageId), eq(pageSeo.locale, locale)));
  return parsePageSeo(row?.data);
}

/** Last modification per page (content or SEO, any locale) for the sitemap. */
export async function getPageLastModified(): Promise<Record<string, string>> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.Sitemap, CacheTag.Settings);
  if (isPreviewMode()) return {};
  const db = await getDb();
  const [content, seo] = await Promise.all([
    db
      .select({ pageId: pageContent.pageId, at: max(pageContent.updatedAt) })
      .from(pageContent)
      .groupBy(pageContent.pageId),
    db
      .select({ pageId: pageSeo.pageId, at: max(pageSeo.updatedAt) })
      .from(pageSeo)
      .groupBy(pageSeo.pageId),
  ]);
  const result: Record<string, string> = {};
  for (const row of [...content, ...seo]) {
    if (!row.at) continue;
    const iso = new Date(row.at).toISOString();
    const current = result[row.pageId];
    if (!current || iso > current) result[row.pageId] = iso;
  }
  return result;
}

/** All (page, locale) pairs marked noindex (sitemap exclusion). */
export async function getNoindexPages(): Promise<Set<string>> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.Sitemap);
  if (isPreviewMode()) return new Set();
  const rows = await (
    await getDb()
  )
    .select({ pageId: pageSeo.pageId, locale: pageSeo.locale, data: pageSeo.data })
    .from(pageSeo);
  return new Set(
    rows
      .filter((row) => parsePageSeo(row.data).noindex)
      .map((row) => `${row.pageId}:${row.locale}`),
  );
}
