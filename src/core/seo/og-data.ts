import 'server-only';

import { registry } from '@/content';
import { seoDefaultsFor } from '@/core/content/define';
import { isEnabledLocale } from '@/core/i18n/locales';
import { getSiteSettings } from '@/core/settings/loader';

import { getPageSeo } from './loader';

export interface OgImageData {
  readonly title: string;
  readonly siteName: string;
  readonly locale: string;
}

/** Text for the generated default share image of a page (null for unknown pages/locales). */
export async function getOgImageData(pageId: string, locale: string): Promise<OgImageData | null> {
  const page = registry.byId(pageId);
  if (!page || !(await isEnabledLocale(locale))) return null;
  const [seo, settings] = await Promise.all([getPageSeo(pageId, locale), getSiteSettings()]);
  return {
    title: seo.ogTitle || seo.title || seoDefaultsFor(page, locale).title,
    siteName: settings.general.siteName,
    locale,
  };
}
