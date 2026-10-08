import { NextResponse, type NextRequest } from 'next/server';

import { hasSessionCookie } from '@/core/auth/cookies';
import { getAuthSecret } from '@/core/auth/secret';
import { isBotUserAgent } from '@/core/http/bots';
import { HeaderName, NO_STORE, ROBOTS_NOINDEX } from '@/core/http/headers';
import { decideLocaleRoute, LOCALE_COOKIE, splitLocale } from '@/core/i18n/routing';
import { ACCESS_PATH, adminHref, AdminRoute, isAdminPath } from '@/core/project/paths';
import { SITE_NOTICE_COOKIE, SiteNotice } from '@/core/site-gate/notice';
import { decideGate, isStaffToken, MAINTENANCE_RETRY_AFTER_SECONDS } from '@/core/site-gate/staff';
import { isNoindex, type SiteState } from '@/core/site-gate/state';
import { getSiteState } from '@/core/site-gate/state-client';
import { GATE_COOKIE_NAME } from '@/core/site-gate/token';

/**
 * Request proxy (Next.js 16 "proxy", formerly middleware). Lightweight: no
 * database driver. Site flags come from the cached /api/site-state endpoint and
 * staff are recognized by a signed cookie. docs/ARCHITECTURE.md § Site gate.
 */
const PUBLIC_ADMIN_PATHS = new Set([adminHref(AdminRoute.Login)]);
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
/** Core routes that are never gated or locale-routed. */
const UNGATED_PREFIXES = ['/api/', ACCESS_PATH];
const MAINTENANCE_SEGMENT = '/maintenance-mode';

export async function proxy(request: NextRequest): Promise<NextResponse> {
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

  if (UNGATED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return next(request, pathname);
  }

  return routeSite(request);
}

async function routeSite(request: NextRequest): Promise<NextResponse> {
  const { pathname, search, origin } = request.nextUrl;
  const state = await getSiteState(origin);
  const staff = await isStaffToken(
    getAuthSecret(),
    request.cookies.get(GATE_COOKIE_NAME)?.value,
    state,
  );
  const gate = decideGate(state, staff);

  if (gate.type === 'private') {
    const accessUrl = new URL(ACCESS_PATH, request.url);
    accessUrl.searchParams.set('next', `${pathname}${search}`);
    return withSiteHeaders(NextResponse.redirect(accessUrl), state, request, staff);
  }
  if (gate.type === 'maintenance') {
    const locale = splitLocale(pathname, state.enabledLocales).locale ?? state.defaultLocale;
    const response = NextResponse.rewrite(
      new URL(`/${locale}${MAINTENANCE_SEGMENT}`, request.url),
      { status: 503 },
    );
    response.headers.set('Retry-After', String(MAINTENANCE_RETRY_AFTER_SECONDS));
    response.headers.set(HeaderName.CacheControl, NO_STORE);
    return withSiteHeaders(response, state, request, staff);
  }

  const decision = decideLocaleRoute(pathname, state, {
    acceptLanguage: request.headers.get('accept-language'),
    cookieLocale: request.cookies.get(LOCALE_COOKIE)?.value,
    isBot: isBotUserAgent(request.headers.get('user-agent')),
  });

  let response: NextResponse;
  switch (decision.type) {
    case 'redirect':
      response = rememberLocale(
        request,
        NextResponse.redirect(new URL(`${decision.pathname}${search}`, request.url), 307),
        decision.locale,
      );
      break;
    case 'rewrite': {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(HeaderName.Pathname, pathname);
      response = rememberLocale(
        request,
        NextResponse.rewrite(new URL(`${decision.pathname}${search}`, request.url), {
          request: { headers: requestHeaders },
        }),
        decision.locale,
      );
      break;
    }
    case 'pass':
      response = rememberLocale(request, next(request, pathname), decision.locale);
      break;
    case 'not-found':
      // The [locale] layout renders the 404 for a disabled locale.
      response = next(request, pathname);
      break;
  }
  return withSiteHeaders(response, state, request, staff);
}

/** noindex while indexing is off / private mode is on; staff banner cookie. */
function withSiteHeaders(
  response: NextResponse,
  state: SiteState,
  request: NextRequest,
  staff: boolean,
): NextResponse {
  if (isNoindex(state)) response.headers.set(HeaderName.RobotsTag, ROBOTS_NOINDEX);
  const notice = staff
    ? state.maintenance
      ? SiteNotice.Maintenance
      : state.privateMode
        ? SiteNotice.Private
        : null
    : null;
  const current = request.cookies.get(SITE_NOTICE_COOKIE)?.value;
  if (notice && current !== notice) {
    response.cookies.set(SITE_NOTICE_COOKIE, notice, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60,
    });
  } else if (!notice && current) {
    response.cookies.delete(SITE_NOTICE_COOKIE);
  }
  return response;
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
