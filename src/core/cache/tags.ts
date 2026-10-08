/**
 * Cache tags used with `cacheTag()` and invalidated with `updateTag()` /
 * `revalidateTag()`. Saving in the admin invalidates only the affected tags.
 */
export const CacheTag = {
  /** Global + localized settings (also affects every page's metadata and layout). */
  Settings: 'settings',
  /** Every locale of one page (content, SEO, shared values). */
  content: (pageId: string) => `content:${pageId}`,
  /** One locale of one page. */
  contentLocale: (pageId: string, locale: string) => `content:${pageId}:${locale}`,
  /** Sitemap (any page's SEO/noindex/lastModified). */
  Sitemap: 'sitemap',
  /** Active staff list published to the request proxy (user disabled, password changed…). */
  Staff: 'staff',
} as const;
