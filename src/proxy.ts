import { NextResponse, type NextRequest } from 'next/server';

import { hasSessionCookie } from '@/core/auth/cookies';
import { HeaderName, NO_STORE, ROBOTS_NOINDEX } from '@/core/http/headers';
import { adminHref, AdminRoute, isAdminPath } from '@/core/project/paths';

/**
 * Request proxy (Next.js 16 "proxy", formerly middleware). Stays lightweight:
 * no database driver. See docs/ARCHITECTURE.md § Request proxy.
 */
const PUBLIC_ADMIN_PATHS = new Set([adminHref(AdminRoute.Login)]);

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
  return next(request, pathname);
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
