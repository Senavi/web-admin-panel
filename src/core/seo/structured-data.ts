import 'server-only';

import { registry } from '@/content';
import type { AnyCollection } from '@/core/content/collection';
import { type AnyPage, type ResolvedSection, seoDefaultsFor } from '@/core/content/define';
import type { FieldMap } from '@/core/content/fields';
import { getLocaleSettings } from '@/core/i18n/locales';
import { localizedPath } from '@/core/i18n/routing';
import { getSiteLogo } from '@/core/media/branding';
import { getSiteSettings } from '@/core/settings/loader';

import { breadcrumbJsonLd, type JsonLdObject, organizationJsonLd, websiteJsonLd } from './json-ld';
import { getPageSeo } from './loader';
import { absoluteUrl } from './site-url';

async function titleOf(page: AnyPage, locale: string): Promise<string> {
  return (await getPageSeo(page.id, locale)).title || seoDefaultsFor(page, locale).title;
}

/** Home → … → page breadcrumb entries (names are SEO titles in the locale). */
async function pageCrumbs(
  page: AnyPage,
  locale: string,
  url: (path: string) => string,
): Promise<Array<{ name: string; url: string }>> {
  const chain: AnyPage[] = [];
  for (
    let current: AnyPage | undefined = page;
    current;
    current = current.parent ? registry.byId(current.parent) : undefined
  ) {
    chain.unshift(current);
  }
  const home = registry.byPath('/');
  if (home && chain[0]?.id !== home.id) chain.unshift(home);
  return Promise.all(
    chain.map(async (item) => ({ name: await titleOf(item, locale), url: url(item.path) })),
  );
}

/** Breadcrumbs for every page; WebSite + Organization on the home page; plus the page hook. */
export async function buildStructuredData(pageId: string, locale: string): Promise<JsonLdObject[]> {
  const page = registry.byId(pageId);
  if (!page) return [];
  const [settings, { defaultLocale }] = await Promise.all([getSiteSettings(), getLocaleSettings()]);
  const url = (path: string) => absoluteUrl(localizedPath(path, locale, defaultLocale));
  const crumbs = await pageCrumbs(page, locale, url);
  const title = crumbs.at(-1)?.name ?? seoDefaultsFor(page, locale).title;

  const data: JsonLdObject[] = [breadcrumbJsonLd(crumbs)];
  if (page.path === '/') {
    const org = settings.seo.organization;
    const logo = await getSiteLogo();
    data.push(
      websiteJsonLd({ name: settings.general.siteName, url: url('/'), inLanguage: locale }),
    );
    data.push(
      organizationJsonLd({
        name: org.name || settings.general.siteName,
        url: org.url || absoluteUrl('/'),
        ...(logo ? { logo: absoluteUrl(logo.src) } : {}),
        sameAs: org.sameAs,
      }),
    );
  }
  if (page.structuredData)
    data.push(...page.structuredData({ locale, url: url(page.path), title }));
  return data;
}

export interface ItemStructuredDataInput {
  readonly collection: AnyCollection;
  readonly locale: string;
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly imageUrl: string | null;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
  readonly content: Readonly<Record<string, unknown>>;
}

/** BreadcrumbList (Home → list page → item) plus the collection's article type or hook. */
export async function buildItemStructuredData(
  input: ItemStructuredDataInput,
): Promise<JsonLdObject[]> {
  const { collection, locale } = input;
  const [settings, { defaultLocale }] = await Promise.all([getSiteSettings(), getLocaleSettings()]);
  const url = (path: string) => absoluteUrl(localizedPath(path, locale, defaultLocale));
  const listPage = registry.byId(collection.listPageId);
  const itemUrl = url(input.path);
  const crumbs = listPage ? await pageCrumbs(listPage, locale, url) : [];
  const data: JsonLdObject[] = [breadcrumbJsonLd([...crumbs, { name: input.title, url: itemUrl }])];

  const { structuredData } = collection;
  if (typeof structuredData === 'function') {
    data.push(
      ...structuredData({
        locale,
        url: itemUrl,
        title: input.title,
        publishedAt: input.publishedAt,
        updatedAt: input.updatedAt,
        content: input.content as ResolvedSection<FieldMap>,
      }),
    );
  } else if (structuredData && structuredData !== 'none') {
    data.push({
      '@type': structuredData,
      headline: input.title,
      ...(input.description ? { description: input.description } : {}),
      ...(input.imageUrl ? { image: input.imageUrl } : {}),
      ...(input.publishedAt ? { datePublished: input.publishedAt } : {}),
      dateModified: input.updatedAt,
      inLanguage: locale,
      url: itemUrl,
      mainEntityOfPage: itemUrl,
      publisher: {
        '@type': 'Organization',
        name: settings.seo.organization.name || settings.general.siteName,
      },
    });
  }
  return data;
}
