/** List pagination (`/blog?page=2`): shared by the list route and the request proxy. */

export const PAGE_PARAM = 'page';

/** `?page=` → page number; null for anything but a positive integer (→ 404). Missing → 1. */
export function parseListPage(value: string | string[] | null | undefined): number | null {
  if (value === undefined || value === null) return 1;
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,5}$/.test(value)) return null;
  return Number(value);
}

export function pageCountFor(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function listPageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}?${PAGE_PARAM}=${page}`;
}
