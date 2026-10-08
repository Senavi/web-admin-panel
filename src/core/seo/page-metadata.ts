import 'server-only';

import type { Metadata } from 'next';

import { registry } from '@/content';
import { seoDefaultsFor } from '@/core/content/define';
import { getLocaleSettings } from '@/core/i18n/locales';
import { localizedPath } from '@/core/i18n/routing';
import { getDb } from '@/core/db/client';
import { loadMedia } from '@/core/media/resolve';
import { getLocalizedSettings, getSiteSettings } from '@/core/settings/loader';
import { isNoindex } from '@/core/site-gate/state';

import { getPageSeo } from './loader';
import { absoluteUrl } from './site-url';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** URL of the generated default OG image for a page (project route under (site)/og). */
export function defaultOgImagePath(pageId: string, locale: string): string {
  return `/og/${locale}/${pageId}.png`;
}

/** hreflang alternates for every enabled locale plus x-default. */
export function languageAlternates(
  path: string,
  enabled: readonly string[],
  defaultLocale: string,
): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of enabled)
    languages[locale] = absoluteUrl(localizedPath(path, locale, defaultLocale));
  languages['x-default'] = absoluteUrl(localizedPath(path, defaultLocale, defaultLocale));
  return languages;
}

export function applyTitleTemplate(template: string, title: string): string {
  return (template || '%s').replace('%s', title);
}

/**
 * Page metadata: page SEO (DB) → page defaults (schema) → site defaults
 * (settings), with the locale's title template, canonical, hreflang, Open
 * Graph, Twitter and robots (per-page noindex, indexing off, private mode).
 */
export async function buildPageMetadata(pageId: string, locale: string): Promise<Metadata> {
  const page = registry.byId(pageId);
  if (!page) return {};
  const [settings, localized, seo, { defaultLocale, enabledLocales }] = await Promise.all([
    getSiteSettings(),
    getLocalizedSettings(locale),
    getPageSeo(pageId, locale),
    getLocaleSettings(),
  ]);

  const defaults = seoDefaultsFor(page, locale);
  const title = seo.title || defaults.title;
  const description = seo.description || defaults.description || localized.description || undefined;
  const url = absoluteUrl(localizedPath(page.path, locale, defaultLocale));
  const ogImageId = seo.ogImageId ?? settings.seo.defaultOgImageId;
  const ogImage = ogImageId
    ? (await loadMedia(await getDb(), [ogImageId])).get(ogImageId)
    : undefined;
  const image = ogImage
    ? { url: absoluteUrl(ogImage.src), width: ogImage.width, height: ogImage.height }
    : { url: absoluteUrl(defaultOgImagePath(pageId, locale)), ...OG_IMAGE_SIZE };
  const noindex =
    seo.noindex ||
    isNoindex({ indexing: settings.status.indexing, privateMode: settings.status.privateMode });

  return {
    title: { absolute: applyTitleTemplate(localized.titleTemplate, title) },
    description,
    alternates: {
      canonical: seo.canonical || url,
      languages: languageAlternates(page.path, enabledLocales, defaultLocale),
    },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      url,
      siteName: settings.general.siteName,
      locale,
      title: seo.ogTitle || localized.ogTitle || title,
      description: seo.ogDescription || localized.ogDescription || description,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.ogTitle || title,
      description: seo.ogDescription || description,
      images: [image.url],
      ...(settings.seo.twitterHandle
        ? {
            site: settings.seo.twitterHandle.startsWith('@')
              ? settings.seo.twitterHandle
              : `@${settings.seo.twitterHandle}`,
          }
        : {}),
    },
  };
}

/** Site-wide metadata for the root site layout: base URL, icons, verification. */
export async function buildSiteMetadata(): Promise<Metadata> {
  const { seo } = await getSiteSettings();
  const other: Record<string, string> = {};
  if (seo.verification.bing) other['msvalidate.01'] = seo.verification.bing;
  return {
    metadataBase: new URL(absoluteUrl('/')),
    manifest: '/manifest.webmanifest',
    verification: {
      ...(seo.verification.google ? { google: seo.verification.google } : {}),
      other,
    },
  };
}
