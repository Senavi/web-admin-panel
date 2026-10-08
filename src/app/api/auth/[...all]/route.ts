import { AUTH_BASE_PATH } from '@/core/auth/server/config';
import { getAuth } from '@/core/auth/server/instance';

/**
 * Better Auth HTTP endpoints. Sign-in, password and 2FA flows run through server
 * actions (with throttling, audit logging and the site-gate cookie), so only
 * read-only / sign-out endpoints are exposed here. Everything else is a 404.
 */
const ALLOWED_PATHS = new Set(['/get-session', '/sign-out', '/ok']);

async function handle(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.slice(AUTH_BASE_PATH.length);
  if (!ALLOWED_PATHS.has(path)) {
    return new Response('Not Found', { status: 404 });
  }
  const auth = await getAuth();
  return auth.handler(request);
}

export { handle as GET, handle as POST };
