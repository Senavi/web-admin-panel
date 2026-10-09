import 'server-only';

import type { Metadata } from 'next';

import { registry } from '@/content';
import { seoDefaultsFor } from '@/core/content/define';
import { getLocaleSettings } from '@/core/i18n/locales';
import { localizedPath } from '@/core/i18n/routing';
import { getMediaInfo } from '@/core/media/resolve';
import { getLocalizedSettings, getSiteSettings } from '@/core/settings/loader';
import { isNoindex } from '@/core/site-gate/state';

import { getPageSeo } from './loader';
import type { PageSeo } from './page-seo';
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

export interface MetadataInput {
  readonly locale: string;
  /** Locale-less public path of the document. */
  readonly path: string;
  /** Locales the document is available in (hreflang alternates). */
  readonly locales: readonly string[];
  readonly defaultLocale: string;
  /** SEO overrides saved in the admin. */
  readonly seo: PageSeo;
  /** Schema/content defaults when an override is empty. */
  readonly defaults: { readonly title: string; readonly description: string };
  /** Media used when neither the SEO override nor the site has an OG image. */
  readonly fallbackImageId?: string | null;
  /** Generated share image path used when no image is available at all. */
  readonly generatedImagePath: string;
  readonly openGraphType?: 'website' | 'article';
  readonly publishedTime?: string | null;
  readonly modifiedTime?: string | null;
}

/**
 * Metadata of a public document: SEO override → document defaults → site
 * defaults (settings), with the locale's title template, canonical, hreflang,
 * Open Graph, Twitter and robots (per-document noindex, indexing off, private mode).
 */
export async function composeMetadata(input: MetadataInput): Promise<Metadata> {
  const { locale, seo, defaults } = input;
  const [settings, localized] = await Promise.all([
    getSiteSettings(),
    getLocalizedSettings(locale),
  ]);
  const title = seo.title || defaults.title;
  const description = seo.description || defaults.description || localized.description || undefined;
  const url = absoluteUrl(localizedPath(input.path, locale, input.defaultLocale));
  const ogImageId = seo.ogImageId ?? input.fallbackImageId ?? settings.seo.defaultOgImageId;
  const ogImage = ogImageId ? await getMediaInfo(ogImageId) : null;
  const image = ogImage
    ? { url: absoluteUrl(ogImage.src), width: ogImage.width, height: ogImage.height }
    : { url: absoluteUrl(input.generatedImagePath), ...OG_IMAGE_SIZE };
  const noindex =
    seo.noindex ||
    isNoindex({ indexing: settings.status.indexing, privateMode: settings.status.privateMode });
  const openGraphBase = {
    url,
    siteName: settings.general.siteName,
    locale,
    title: seo.ogTitle || localized.ogTitle || title,
    description: seo.ogDescription || localized.ogDescription || description,
    images: [image],
  };

  return {
    title: { absolute: applyTitleTemplate(localized.titleTemplate, title) },
    description,
    alternates: {
      canonical: seo.canonical || url,
      languages: languageAlternates(input.path, input.locales, input.defaultLocale),
    },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph:
      input.openGraphType === 'article'
        ? {
            ...openGraphBase,
            type: 'article',
            ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
            ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
          }
        : { ...openGraphBase, type: 'website' },
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

/** Page metadata (see `composeMetadata`). */
export async function buildPageMetadata(pageId: string, locale: string): Promise<Metadata> {
  const page = registry.byId(pageId);
  if (!page) return {};
  const [seo, { defaultLocale, enabledLocales }] = await Promise.all([
    getPageSeo(pageId, locale),
    getLocaleSettings(),
  ]);
  return composeMetadata({
    locale,
    path: page.path,
    locales: enabledLocales,
    defaultLocale,
    seo,
    defaults: seoDefaultsFor(page, locale),
    generatedImagePath: defaultOgImagePath(pageId, locale),
  });
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
