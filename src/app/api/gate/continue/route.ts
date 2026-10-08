import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/core/auth/server/session';
import { safeRedirectPath } from '@/core/project/paths';
import { issueGateCookie } from '@/core/site-gate/cookie';

/**
 * A user who is already signed in (admin session) but lacks a fresh site-gate
 * cookie lands here from /access: re-issue the cookie, then continue.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const next = safeRedirectPath(url.searchParams.get('next'), '/');
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/access?next=${encodeURIComponent(next)}`, url));
  await issueGateCookie({ id: user.id, role: user.role, sessionVersion: user.sessionVersion });
  return NextResponse.redirect(new URL(next, url));
}
