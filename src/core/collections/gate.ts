import { localizedPath } from '@/core/i18n/routing';
import { matchesRoute } from '@/core/i18n/route-match';

import { SLUG_PLACEHOLDER } from '@/core/content/collection';

import { pageCountFor, parseListPage } from './pagination';

/**
 * What the request proxy knows about collections (published in the site state).
 * Streaming responses can't change their status once the static shell is sent,
 * so 404s for unknown slugs, 308s for old slugs and 404s for out-of-range list
 * pages are decided here, before rendering (docs/DECISIONS.md D-066).
 */
export interface CollectionGateState {
  /** `/blog/:slug` */
  readonly itemPath: string;
  /** `/blog` */
  readonly listPath: string;
  readonly pageSize: number;
  /** Published items: slug → locales where the item is shown. */
  readonly items: Readonly<Record<string, readonly string[]>>;
  /** Old slug → current slug. */
  readonly redirects: Readonly<Record<string, string>>;
}

/** Cookie set by Next.js Draft Mode (staff previews may show drafts). */
export const DRAFT_MODE_COOKIE = '__prerender_bypass';

/** Draft Mode cookie attributes (as Next.js sets them) limited to one URL path. */
export function draftCookieOptions(path: string) {
  const production = process.env.NODE_ENV !== 'development';
  return {
    httpOnly: true,
    sameSite: production ? ('none' as const) : ('lax' as const),
    secure: production,
    path,
  };
}

export type CollectionRouteDecision =
  | { readonly type: 'pass' }
  | { readonly type: 'not-found' }
  | { readonly type: 'redirect'; readonly pathname: string };

const PASS: CollectionRouteDecision = { type: 'pass' };
const NOT_FOUND: CollectionRouteDecision = { type: 'not-found' };

export function decideCollectionRoute(input: {
  /** Locale-less path, e.g. `/blog/hello`. */
  readonly path: string;
  readonly locale: string;
  readonly defaultLocale: string;
  /** Raw `?page=` value (null when absent). */
  readonly pageParam: string | null;
  readonly draftMode: boolean;
  readonly collections: readonly CollectionGateState[];
}): CollectionRouteDecision {
  const { path, locale } = input;
  for (const collection of input.collections) {
    if (path === collection.listPath) {
      if (input.pageParam === null) return PASS;
      const page = parseListPage(input.pageParam);
      const visible = Object.values(collection.items).filter((locales) => locales.includes(locale));
      return page !== null && page <= pageCountFor(visible.length, collection.pageSize)
        ? PASS
        : NOT_FOUND;
    }
    if (!matchesRoute(path, collection.itemPath)) continue;
    if (input.draftMode) return PASS;
    const slug = path.slice(path.lastIndexOf('/') + 1);
    if (collection.items[slug]?.includes(locale)) return PASS;
    const current = collection.redirects[slug];
    if (current && collection.items[current]?.includes(locale)) {
      const target = collection.itemPath.replace(SLUG_PLACEHOLDER, current);
      return { type: 'redirect', pathname: localizedPath(target, locale, input.defaultLocale) };
    }
    return NOT_FOUND;
  }
  return PASS;
}
