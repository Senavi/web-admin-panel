import { NextResponse, type NextRequest } from 'next/server';
import { projectConfig } from '@project/config';

import { hasSessionCookie } from '@/core/auth/cookies';
import { decideCollectionRoute, DRAFT_MODE_COOKIE } from '@/core/collections/gate';
import { PAGE_PARAM } from '@/core/collections/pagination';
import { can } from '@/core/auth/permissions';
import { permissionForAdminPath } from '@/core/auth/route-permissions';
import { getAuthSecret } from '@/core/auth/secret';
import { isBotUserAgent } from '@/core/http/bots';
import { HeaderName, NO_STORE, ROBOTS_NOINDEX } from '@/core/http/headers';
import {
  adminCsp,
  createNonce,
  CSP_HEADER,
  NONCE_HEADER,
  staticPageCsp,
} from '@/core/security/headers';
import { isKnownRoute } from '@/core/i18n/route-match';
import { isPreviewMode } from '@/core/preview/mode';
import { STORYBOOK_PATH } from '@/core/storybook/slot';
import { decideLocaleRoute, LOCALE_COOKIE, splitLocale } from '@/core/i18n/routing';
import {
  ACCESS_PATH,
  adminHref,
  AdminRoute,
  hasCustomAdminPath,
  isAdminPath,
  isInternalAdminPath,
  toInternalAdminPath,
} from '@/core/project/paths';
import { SITE_NOTICE_COOKIE, SiteNotice } from '@/core/site-gate/notice';
import { decideGate, isStaffToken, MAINTENANCE_RETRY_AFTER_SECONDS } from '@/core/site-gate/staff';
import {
  isNoindex,
  SITE_STATE_VERSION_COOKIE,
  SiteRoute,
  type SiteState,
} from '@/core/site-gate/state';
import { getSiteState, parseStateVersion, siteStateKey } from '@/core/site-gate/state-client';
import { GATE_COOKIE_NAME, verifyGateToken } from '@/core/site-gate/token';

/**
 * Request proxy (Next.js 16 "proxy", formerly middleware). Lightweight: no
 * database driver. Site flags come from the cached /api/site-state endpoint and
 * staff are recognized by a signed cookie. docs/ARCHITECTURE.md § Site gate.
 */
const PUBLIC_ADMIN_PATHS = new Set([adminHref(AdminRoute.Login), adminHref(AdminRoute.NotAllowed)]);
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
/** Core routes that are never gated or locale-routed. */
const UNGATED_PREFIXES = ['/api/', ACCESS_PATH];
/** Marks the proxy's internal subrequests (value: the HMAC site-state key). */
const INTERNAL_HEADER = 'x-site-internal';
const UNKNOWN_STATE_RETRY_AFTER_SECONDS = 30;
/** API routes that work without a database (preview mode); the rest answer 404. */
const PREVIEW_API_PREFIXES = [
  '/api/site-state',
  '/api/seed-assets/',
  '/api/forms/submit',
  '/api/forms/token',
  '/api/collect',
  '/api/cron/',
];

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  if (isPreviewMode()) {
    const preview = previewModeResponse(request, pathname);
    if (preview) return preview;
  }

  if (isAdminPath(pathname)) {
    // Optimistic check only; pages still verify the session on the server.
    if (!PUBLIC_ADMIN_PATHS.has(pathname) && !hasSessionCookie(request.cookies)) {
      const loginUrl = new URL(adminHref(AdminRoute.Login), request.url);
      loginUrl.searchParams.set('next', `${pathname}${search}`);
      return withAdminHeaders(NextResponse.redirect(loginUrl));
    }
    if (await isForbiddenAdminPath(request, pathname)) {
      return withAdminHeaders(
        await staticPageResponse(request.nextUrl.origin, adminHref(AdminRoute.NotAllowed), 404),
      );
    }
    return withAdminHeaders(adminNext(request, pathname));
  }

  if (UNGATED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return next(request, pathname);
  }

  if (pathname === STORYBOOK_PATH || pathname.startsWith(`${STORYBOOK_PATH}/`)) {
    return storybookResponse(request);
  }

  return routeSite(request);
}

/**
 * `/storybook` is for staff only: a valid admin session (the signed gate cookie, any role)
 * continues to the page; everyone else gets exactly the site's 404, never a login redirect,
 * so the page's existence isn't revealed. Never cached or indexed; not in robots.txt.
 */
async function storybookResponse(request: NextRequest): Promise<NextResponse> {
  const { origin, pathname } = request.nextUrl;
  const state = await siteStateFor(request);
  const staff =
    state !== null &&
    (await isStaffToken(getAuthSecret(), request.cookies.get(GATE_COOKIE_NAME)?.value, state));
  const response = staff
    ? next(request, pathname)
    : await staticPageResponse(
        origin,
        `/${state?.defaultLocale ?? projectConfig.defaultLocale}${SiteRoute.NotFound}`,
        404,
      );
  response.headers.set(HeaderName.RobotsTag, ROBOTS_NOINDEX);
  response.headers.set(HeaderName.CacheControl, NO_STORE);
  return response;
}

/**
 * Preview mode (production without a database): every admin URL shows the
 * setup guide (no login, no data), database-backed API routes answer 404 and
 * the visitor sign-in page goes home. Null: continue with normal routing.
 */
function previewModeResponse(request: NextRequest, pathname: string): NextResponse | null {
  if (isAdminPath(pathname)) {
    const setup = adminHref(AdminRoute.Setup);
    return withAdminHeaders(adminNext(request, pathname, setup));
  }
  if (pathname.startsWith('/api/')) {
    if (PREVIEW_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
    return NextResponse.json(
      { error: 'This site isn’t connected to a database yet.' },
      { status: 404, headers: { [HeaderName.CacheControl]: NO_STORE } },
    );
  }
  if (pathname === ACCESS_PATH || pathname.startsWith(`${ACCESS_PATH}/`)) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return null;
}

async function routeSite(request: NextRequest): Promise<NextResponse> {
  const { pathname, search, origin } = request.nextUrl;
  // With a custom adminPath the internal admin folder is not a public URL: site 404.
  if (hasCustomAdminPath() && isInternalAdminPath(pathname)) {
    const state = await siteStateFor(request);
    if (!state && !isPreviewMode()) return unavailableResponse();
    const locale = state?.defaultLocale ?? projectConfig.defaultLocale;
    const notFound = await staticPageResponse(origin, `/${locale}${SiteRoute.NotFound}`, 404);
    notFound.headers.set(HeaderName.RobotsTag, ROBOTS_NOINDEX);
    return notFound;
  }
  // The proxy's own subrequest for the static 404 page.
  if (request.headers.get(INTERNAL_HEADER) === (await siteStateKey()))
    return next(request, pathname);
  const state = await siteStateFor(request);
  if (!state) {
    // Preview mode has no private content: serve the page (never indexable).
    if (isPreviewMode()) {
      const response = next(request, pathname);
      response.headers.set(HeaderName.RobotsTag, ROBOTS_NOINDEX);
      return response;
    }
    // Unknown site state (cold instance, state endpoint unreachable): fail closed.
    return unavailableResponse();
  }
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
    const response = await staticPageResponse(origin, `/${locale}${SiteRoute.Maintenance}`, 503);
    response.headers.set('Retry-After', String(MAINTENANCE_RETRY_AFTER_SECONDS));
    return withSiteHeaders(response, state, request, staff);
  }

  const decision = decideLocaleRoute(pathname, state, {
    acceptLanguage: request.headers.get('accept-language'),
    cookieLocale: request.cookies.get(LOCALE_COOKIE)?.value,
    isBot: isBotUserAgent(request.headers.get('user-agent')),
    staff,
  });

  // Unknown URLs get the static localized 404 page with HTTP 404.
  if (decision.type === 'rewrite' || decision.type === 'pass') {
    const { rest } = splitLocale(
      decision.type === 'rewrite' ? decision.pathname : pathname,
      state.supportedLocales,
    );
    const collectionDecision = decideCollectionRoute({
      path: rest,
      locale: decision.locale,
      defaultLocale: state.defaultLocale,
      pageParam: request.nextUrl.searchParams.get(PAGE_PARAM),
      draftMode: request.cookies.has(DRAFT_MODE_COOKIE),
      collections: state.collections,
    });
    if (collectionDecision.type === 'redirect') {
      const target = new URL(`${collectionDecision.pathname}${search}`, request.url);
      return withSiteHeaders(NextResponse.redirect(target, 308), state, request, staff);
    }
    if (!isKnownRoute(rest, state.routes) || collectionDecision.type === 'not-found') {
      const notFound = await staticPageResponse(
        origin,
        `/${decision.locale}${SiteRoute.NotFound}`,
        404,
      );
      return withSiteHeaders(notFound, state, request, staff);
    }
  }

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
      // A draft language without a staff session looks like any unknown URL.
      response = await staticPageResponse(
        origin,
        `/${state.defaultLocale}${SiteRoute.NotFound}`,
        404,
      );
      break;
  }
  return withSiteHeaders(response, state, request, staff);
}

/** Cached site state; reloaded first if this browser just changed it (version cookie). */
function siteStateFor(request: NextRequest): Promise<SiteState | null> {
  return getSiteState(request.nextUrl.origin, {
    changedAt: parseStateVersion(request.cookies.get(SITE_STATE_VERSION_COOKIE)?.value),
  });
}

/** 503 when the site state can't be determined (never serve possibly-private content). */
function unavailableResponse(): NextResponse {
  return new NextResponse('Service temporarily unavailable. Please try again shortly.', {
    status: 503,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Retry-After': String(UNKNOWN_STATE_RETRY_AFTER_SECONDS),
      [HeaderName.CacheControl]: NO_STORE,
      [HeaderName.RobotsTag]: ROBOTS_NOINDEX,
    },
  });
}

/**
 * Serves an internal page (maintenance, 404, admin "not allowed") with a specific status.
 * In production Next.js ignores the status of a rewrite to a static page, so
 * the proxy fetches the page itself (marked as internal to skip the gate) and
 * returns its HTML with the wanted status.
 */
async function staticPageResponse(
  origin: string,
  path: string,
  status: number,
): Promise<NextResponse> {
  try {
    const page = await fetch(new URL(path, origin), {
      headers: { [INTERNAL_HEADER]: await siteStateKey() },
      signal: AbortSignal.timeout(5000),
    });
    return new NextResponse(page.body, {
      status,
      headers: {
        'Content-Type': page.headers.get('content-type') ?? 'text/html; charset=utf-8',
        [HeaderName.CacheControl]: NO_STORE,
        [CSP_HEADER]: page.headers.get(CSP_HEADER) ?? staticPageCsp(projectConfig.csp),
      },
    });
  } catch {
    return new NextResponse(status === 503 ? 'Service unavailable' : 'Not found', { status });
  }
}

/** noindex while indexing is off / private mode is on; staff banner cookie. */
function withSiteHeaders(
  response: NextResponse,
  state: SiteState,
  request: NextRequest,
  staff: boolean,
): NextResponse {
  if (isNoindex(state) || isPreviewMode())
    response.headers.set(HeaderName.RobotsTag, ROBOTS_NOINDEX);
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

/**
 * Early 404 for admin-only screens when the signed gate cookie says the user's
 * role lacks the permission. Pages still enforce permissions on the server.
 */
async function isForbiddenAdminPath(request: NextRequest, pathname: string): Promise<boolean> {
  // Page views only: server actions (POST) are always checked by the action itself.
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const permission = permissionForAdminPath(pathname);
  if (!permission) return false;
  const token = await verifyGateToken(
    getAuthSecret(),
    request.cookies.get(GATE_COOKIE_NAME)?.value,
  );
  if (!token) return false;
  // Only trust the role if the token is still current (role changes bump the session version).
  const state = await siteStateFor(request);
  // Without state, leave the decision to the server-side page guard.
  return state !== null && state.staff[token.uid] === token.v && !can(token.role, permission);
}

function next(request: NextRequest, pathname: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(HeaderName.Pathname, pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

/** Admin pages render per request: a fresh nonce CSP (Next.js applies the nonce to its scripts). */
/**
 * Admin request with a fresh CSP nonce. The public admin URL (`/<adminPath>/…`)
 * is served from the internal `/admin/…` routes; `servePath` (a public admin
 * path) shows another admin page at this URL (preview mode setup guide).
 */
function adminNext(request: NextRequest, pathname: string, servePath = pathname): NextResponse {
  const nonce = createNonce();
  const csp = adminCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(HeaderName.Pathname, pathname);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(CSP_HEADER, csp);
  const internal = toInternalAdminPath(servePath);
  const response =
    internal === request.nextUrl.pathname
      ? NextResponse.next({ request: { headers: requestHeaders } })
      : NextResponse.rewrite(new URL(`${internal}${request.nextUrl.search}`, request.url), {
          request: { headers: requestHeaders },
        });
  response.headers.set(CSP_HEADER, csp);
  return response;
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
