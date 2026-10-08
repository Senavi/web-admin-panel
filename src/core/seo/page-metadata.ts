import 'server-only';

import type { Metadata } from 'next';

import { registry } from '@/content';
import { getLocalizedSettings } from '@/core/settings/loader';

/**
 * Page metadata: page SEO (DB) → page defaults (schema) → site defaults (settings).
 * Extended with canonical/hreflang/OG in the SEO phase.
 */
export async function buildPageMetadata(pageId: string, locale: string): Promise<Metadata> {
  const page = registry.byId(pageId);
  if (!page) return {};
  const localized = await getLocalizedSettings(locale);
  const template = localized.titleTemplate || '%s';
  return {
    title: { absolute: template.replace('%s', page.seo.title) },
    description: page.seo.description ?? localized.description,
  };
}
