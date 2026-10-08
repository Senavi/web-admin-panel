import type { MetadataRoute } from 'next';

import { buildRobots } from '@/core/seo/sitemap';

export default function robots(): Promise<MetadataRoute.Robots> {
  return buildRobots();
}
