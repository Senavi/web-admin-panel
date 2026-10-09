/** Draft Mode endpoints for staff previews of collection items (client-safe constants). */
export const PREVIEW_PATH = '/api/preview';
export const PREVIEW_EXIT_PATH = '/api/preview/exit';

/** Admin "Preview" link: enables Draft Mode, then opens the item. */
export function previewHref(collectionId: string, itemId: string, locale: string): string {
  const query = new URLSearchParams({ collection: collectionId, item: itemId, locale });
  return `${PREVIEW_PATH}?${query.toString()}`;
}
