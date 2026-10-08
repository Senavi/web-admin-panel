import { getAuthSecret } from '@/core/auth/secret';
import { HmacPurpose, hmacSign } from '@/core/security/crypto';

import { defaultSiteState, SITE_STATE_KEY_HEADER, SITE_STATE_PATH, type SiteState } from './state';

/**
 * Proxy-side access to the site state. The state endpoint is cached on the
 * server (and invalidated by tags on save); the proxy additionally keeps it in
 * memory for a few seconds per instance. Fails safe to the last known state.
 */
const TTL_MS = Number(process.env.SITE_STATE_TTL_MS ?? 3000);
const FETCH_TIMEOUT_MS = 3000;

let cached: { value: SiteState; expires: number } | undefined;
let inflight: Promise<SiteState> | undefined;

export function siteStateKey(): Promise<string> {
  return hmacSign(getAuthSecret(), HmacPurpose.SiteState, SITE_STATE_PATH);
}

export async function getSiteState(origin: string): Promise<SiteState> {
  if (cached && cached.expires > Date.now()) return cached.value;
  inflight ??= fetchState(origin).finally(() => {
    inflight = undefined;
  });
  return inflight;
}

async function fetchState(origin: string): Promise<SiteState> {
  try {
    const response = await fetch(new URL(SITE_STATE_PATH, origin), {
      headers: { [SITE_STATE_KEY_HEADER]: await siteStateKey() },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`site-state responded ${response.status}`);
    const value = (await response.json()) as SiteState;
    cached = { value, expires: Date.now() + TTL_MS };
    return value;
  } catch (error) {
    console.error('[proxy] could not load site state; using last known state', error);
    return cached?.value ?? defaultSiteState();
  }
}
