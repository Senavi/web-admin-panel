import 'server-only';

import type { MetadataRoute } from 'next';

import { registry } from '@/content';
import { getCollectionSitemapItems } from '@/core/collections/loader';
import { localizedPath } from '@/core/i18n/routing';
import { getSiteSettings } from '@/core/settings/loader';
import { isNoindex } from '@/core/site-gate/state';

import { getNoindexPages, getPageLastModified } from './loader';
import { absoluteUrl, getSiteUrl } from './site-url';

/**
 * Sitemap: registry × enabled locales with hreflang alternates and lastModified,
 * excluding noindex pages. Empty while indexing is off or the site is private.
 */
export async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSiteSettings();
  if (isNoindex({ indexing: settings.status.indexing, privateMode: settings.status.privateMode }))
    return [];
  const { enabledLocales, defaultLocale } = settings.general;
  const [lastModified, noindex, items] = await Promise.all([
    getPageLastModified(),
    getNoindexPages(),
    getCollectionSitemapItems(enabledLocales, defaultLocale),
  ]);

  const entries: MetadataRoute.Sitemap = [];
  for (const page of registry.pages) {
    const locales = enabledLocales.filter((locale) => !noindex.has(`${page.id}:${locale}`));
    const languages = Object.fromEntries(
      locales.map((locale) => [
        locale,
        absoluteUrl(localizedPath(page.path, locale, defaultLocale)),
      ]),
    );
    for (const locale of locales) {
      entries.push({
        url: absoluteUrl(localizedPath(page.path, locale, defaultLocale)),
        ...(lastModified[page.id] ? { lastModified: lastModified[page.id] } : {}),
        alternates: { languages },
      });
    }
  }
  for (const item of items) {
    const languages = Object.fromEntries(
      item.locales.map((locale) => [
        locale,
        absoluteUrl(localizedPath(item.path, locale, defaultLocale)),
      ]),
    );
    for (const locale of item.locales) {
      entries.push({
        url: absoluteUrl(localizedPath(item.path, locale, defaultLocale)),
        lastModified: item.lastModified,
        alternates: { languages },
      });
    }
  }
  return entries;
}

export const PRIVATE_PATHS = ['/admin', '/api/', '/access'];

export async function buildRobots(): Promise<MetadataRoute.Robots> {
  const { status } = await getSiteSettings();
  if (isNoindex({ indexing: status.indexing, privateMode: status.privateMode })) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: PRIVATE_PATHS }],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
