import { resolveSiteUrl } from '@/core/site-url';

/** Development and preview builds without any address. */
const LOCAL_SITE_URL = 'http://localhost:3000';

/** Public origin used for canonical URLs, sitemap and OG tags (see `resolveSiteUrl`). */
export function getSiteUrl(): string {
  return resolveSiteUrl() ?? LOCAL_SITE_URL;
}

export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}
