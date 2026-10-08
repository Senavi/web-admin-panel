import 'server-only';

import { registry } from '@/content';
import { type AnyPage, seoDefaultsFor } from '@/core/content/define';
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

/** Breadcrumbs for every page; WebSite + Organization on the home page; plus the page hook. */
export async function buildStructuredData(pageId: string, locale: string): Promise<JsonLdObject[]> {
  const page = registry.byId(pageId);
  if (!page) return [];
  const [settings, { defaultLocale }] = await Promise.all([getSiteSettings(), getLocaleSettings()]);
  const url = (path: string) => absoluteUrl(localizedPath(path, locale, defaultLocale));

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
  const crumbs = await Promise.all(
    chain.map(async (item) => ({ name: await titleOf(item, locale), url: url(item.path) })),
  );
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
