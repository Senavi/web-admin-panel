/**
 * Locale routing rules (pure; used by the request proxy). The default locale
 * has no prefix (`/about`), other enabled locales are prefixed (`/uk/about`).
 * docs/ARCHITECTURE.md § i18n routing.
 */

export interface LocaleState {
  readonly defaultLocale: string;
  readonly enabledLocales: readonly string[];
  /** All locales the project supports (enabled or not). */
  readonly supportedLocales: readonly string[];
}

export const LOCALE_COOKIE = 'site_locale';

export type LocaleDecision =
  /** Serve `/{locale}{path}` internally. */
  | { readonly type: 'rewrite'; readonly pathname: string; readonly locale: string }
  /** Send the browser elsewhere (canonical URL or detected language). */
  | { readonly type: 'redirect'; readonly pathname: string; readonly locale: string }
  /** Prefixed, valid URL: serve as-is. */
  | { readonly type: 'pass'; readonly locale: string }
  /** Supported but disabled locale: respond 404. */
  | { readonly type: 'not-found' };

export interface RequestHints {
  readonly acceptLanguage?: string | null;
  readonly cookieLocale?: string | null;
  readonly isBot: boolean;
}

/** `/uk/about` → { locale: 'uk', rest: '/about' } when `uk` is supported. */
export function splitLocale(
  pathname: string,
  supported: readonly string[],
): { locale: string | null; rest: string } {
  const [, first = '', ...rest] = pathname.split('/');
  if (supported.includes(first))
    return { locale: first, rest: `/${rest.join('/')}`.replace(/\/$/, '') || '/' };
  return { locale: null, rest: pathname };
}

export function localizedPath(path: string, locale: string, defaultLocale: string): string {
  if (locale === defaultLocale) return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

/** Picks the best enabled locale from an Accept-Language header (language part only). */
export function negotiateLocale(
  acceptLanguage: string | null | undefined,
  enabled: readonly string[],
): string | null {
  if (!acceptLanguage) return null;
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const quality = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { tag: tag.toLowerCase(), q: quality ? Number(quality.slice(2)) : 1 };
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => b.q - a.q);
  const lowered = enabled.map((locale) => locale.toLowerCase());
  for (const { tag } of ranked) {
    const exact = lowered.indexOf(tag);
    if (exact >= 0) return enabled[exact] ?? null;
    const base = lowered.indexOf(tag.split('-')[0] ?? '');
    if (base >= 0) return enabled[base] ?? null;
  }
  return null;
}

export function decideLocaleRoute(
  pathname: string,
  state: LocaleState,
  hints: RequestHints,
): LocaleDecision {
  const { locale, rest } = splitLocale(pathname, state.supportedLocales);

  if (locale) {
    if (!state.enabledLocales.includes(locale)) return { type: 'not-found' };
    // The default locale is served without a prefix: /en/about → /about.
    if (locale === state.defaultLocale) return { type: 'redirect', pathname: rest, locale };
    return { type: 'pass', locale };
  }

  // Language detection only on the home page, only once (cookie), never for crawlers.
  if (pathname === '/' && !hints.isBot) {
    const remembered =
      hints.cookieLocale && state.enabledLocales.includes(hints.cookieLocale)
        ? hints.cookieLocale
        : null;
    const preferred =
      remembered ??
      (hints.cookieLocale ? null : negotiateLocale(hints.acceptLanguage, state.enabledLocales));
    if (preferred && preferred !== state.defaultLocale) {
      return {
        type: 'redirect',
        pathname: localizedPath('/', preferred, state.defaultLocale),
        locale: preferred,
      };
    }
  }
  const internal =
    pathname === '/' ? `/${state.defaultLocale}` : `/${state.defaultLocale}${pathname}`;
  return { type: 'rewrite', pathname: internal, locale: state.defaultLocale };
}
