import type { MetadataRoute } from 'next';

import { buildSitemap } from '@/core/seo/sitemap';

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap();
}
