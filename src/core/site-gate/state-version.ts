import 'server-only';

import { updateTag } from 'next/cache';
import { cookies } from 'next/headers';

import { CacheTag } from '@/core/cache/tags';
import { isProduction } from '@/core/env';

import { SITE_STATE_VERSION_COOKIE, SITE_STATE_VERSION_MAX_AGE_SECONDS } from './state';

/**
 * After a change the request proxy must see (settings, staff, published
 * items): the proxy refreshes its cached site state in the background, so
 * other visitors see the change within `SITE_STATE_TTL_MS`. The person who made
 * the change gets a short-lived cookie with the change time; the proxy then
 * reloads the state once for their next request, so they see it immediately.
 */
export async function markSiteStateChanged(): Promise<void> {
  try {
    (await cookies()).set(SITE_STATE_VERSION_COOKIE, String(Date.now()), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction(),
      maxAge: SITE_STATE_VERSION_MAX_AGE_SECONDS,
    });
  } catch {
    // Not in a server action / route handler (cookies are read-only): background refresh only.
  }
}

/** Invalidates cache tags that feed the site state and marks the change for this user. */
export async function siteStateChanged(...tags: string[]): Promise<void> {
  for (const tag of tags) updateTag(tag);
  await markSiteStateChanged();
}

/** True for tags that feed the proxy's site state. */
export function feedsSiteState(tag: string): boolean {
  return (
    tag === CacheTag.Settings ||
    tag === CacheTag.Staff ||
    (tag.startsWith('collection:') && tag.endsWith(':list'))
  );
}
