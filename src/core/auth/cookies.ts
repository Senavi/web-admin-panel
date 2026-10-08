/**
 * Better Auth cookie names (prefix `site`, see server/config.ts). Kept free of
 * server imports so the request proxy can do optimistic "has a session cookie"
 * checks. Real validation always happens on the server.
 */
export const AUTH_COOKIE_PREFIX = 'site';
const SESSION_COOKIE = `${AUTH_COOKIE_PREFIX}.session_token`;
const SECURE_PREFIX = '__Secure-';

export const SESSION_COOKIE_NAMES = [SESSION_COOKIE, `${SECURE_PREFIX}${SESSION_COOKIE}`] as const;

export function hasSessionCookie(cookies: { has: (name: string) => boolean }): boolean {
  return SESSION_COOKIE_NAMES.some((name) => cookies.has(name));
}
