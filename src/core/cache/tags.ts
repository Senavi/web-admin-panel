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
  /** Everything of one collection (bulk changes, e.g. content:sync). */
  collection: (collectionId: string) => `collection:${collectionId}`,
  /** One collection item, all locales (by slug: the site looks items up by slug). */
  collectionItem: (collectionId: string, slug: string) => `collection:${collectionId}:${slug}`,
  /** List pages, counts and "latest items" blocks of a collection. */
  collectionList: (collectionId: string) => `collection:${collectionId}:list`,
  /** One media item (rows are immutable; tag exists for deletes). */
  media: (mediaId: string) => `media:${mediaId}`,
  /** Active staff list published to the request proxy (user disabled, password changed…). */
  Staff: 'staff',
} as const;
