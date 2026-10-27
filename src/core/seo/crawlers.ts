/** Crawler files answered by the request proxy on staging (D-097). Edge-safe constants. */
export const ROBOTS_PATH = '/robots.txt';
export const SITEMAP_PATH = '/sitemap.xml';

export const STAGING_ROBOTS_TXT = 'User-Agent: *\nDisallow: /\n';

export const EMPTY_SITEMAP_XML =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';
