import { NextResponse, type NextRequest } from 'next/server';

import { hasSessionCookie } from '@/core/auth/cookies';
import { isBotUserAgent } from '@/core/http/bots';
import { HeaderName, NO_STORE, ROBOTS_NOINDEX } from '@/core/http/headers';
import { decideLocaleRoute, LOCALE_COOKIE } from '@/core/i18n/routing';
import { ACCESS_PATH, adminHref, AdminRoute, isAdminPath } from '@/core/project/paths';
import { defaultSiteState } from '@/core/site-gate/state';

/**
 * Request proxy (Next.js 16 "proxy", formerly middleware). Stays lightweight:
 * no database driver. See docs/ARCHITECTURE.md § Request proxy.
 */
const PUBLIC_ADMIN_PATHS = new Set([adminHref(AdminRoute.Login)]);
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
/** Paths handled by core routes, never locale-routed. */
const NON_SITE_PREFIXES = ['/api/', ACCESS_PATH];

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (isAdminPath(pathname)) {
    // Optimistic check only; pages still verify the session on the server.
    if (!PUBLIC_ADMIN_PATHS.has(pathname) && !hasSessionCookie(request.cookies)) {
      const loginUrl = new URL(adminHref(AdminRoute.Login), request.url);
      loginUrl.searchParams.set('next', `${pathname}${search}`);
      return withAdminHeaders(NextResponse.redirect(loginUrl));
    }
    return withAdminHeaders(next(request, pathname));
  }

  if (NON_SITE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return next(request, pathname);
  }

  return routeSite(request);
}

function routeSite(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const state = defaultSiteState();
  const decision = decideLocaleRoute(pathname, state, {
    acceptLanguage: request.headers.get('accept-language'),
    cookieLocale: request.cookies.get(LOCALE_COOKIE)?.value,
    isBot: isBotUserAgent(request.headers.get('user-agent')),
  });

  switch (decision.type) {
    case 'redirect': {
      const url = new URL(`${decision.pathname}${search}`, request.url);
      return rememberLocale(request, NextResponse.redirect(url, 307), decision.locale);
    }
    case 'rewrite': {
      const url = new URL(`${decision.pathname}${search}`, request.url);
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(HeaderName.Pathname, pathname);
      return rememberLocale(
        request,
        NextResponse.rewrite(url, { request: { headers: requestHeaders } }),
        decision.locale,
      );
    }
    case 'pass':
      return rememberLocale(request, next(request, pathname), decision.locale);
    case 'not-found': {
      // Let the [locale] layout render the localized 404 for the disabled locale.
      return next(request, pathname);
    }
  }
}

/** Remembers the visitor's language choice (only when it changes; never for bots). */
function rememberLocale(
  request: NextRequest,
  response: NextResponse,
  locale: string,
): NextResponse {
  if (request.cookies.get(LOCALE_COOKIE)?.value === locale) return response;
  if (isBotUserAgent(request.headers.get('user-agent'))) return response;
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
  });
  return response;
}

function next(request: NextRequest, pathname: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(HeaderName.Pathname, pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function withAdminHeaders(response: NextResponse): NextResponse {
  response.headers.set(HeaderName.CacheControl, NO_STORE);
  response.headers.set(HeaderName.RobotsTag, ROBOTS_NOINDEX);
  return response;
}

export const config = {
  matcher: [
    // Everything except Next.js internals and static files with an extension.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
