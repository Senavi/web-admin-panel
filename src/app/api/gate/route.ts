import { getCurrentUser } from '@/core/auth/server/session';
import { assertSameOrigin } from '@/core/security/origin';
import { issueGateCookie } from '@/core/site-gate/cookie';

/**
 * Refreshes the signed site-gate cookie for a signed-in staff user. Called by
 * the admin shell so staff keep bypassing maintenance / private mode while their
 * admin session is valid (the cookie itself expires after 12 hours).
 */
export async function POST(request: Request): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  await issueGateCookie({ id: user.id, role: user.role, sessionVersion: user.sessionVersion });
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
