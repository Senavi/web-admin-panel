/** Header values shared by the proxy and route handlers. */
export const NO_STORE = 'private, no-cache, no-store, max-age=0, must-revalidate';
export const ROBOTS_NOINDEX = 'noindex, nofollow';

export const HeaderName = {
  CacheControl: 'Cache-Control',
  RobotsTag: 'X-Robots-Tag',
  /** Request header set by the proxy so server components know the pathname. */
  Pathname: 'x-site-pathname',
} as const;
