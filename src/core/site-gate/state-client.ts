import { getAuthSecret } from '@/core/auth/secret';
import { HmacPurpose, hmacSign } from '@/core/security/crypto';

import { SITE_STATE_KEY_HEADER, SITE_STATE_PATH, type SiteState } from './state';

/**
 * Proxy-side access to the site state. The state endpoint is cached on the
 * server (and invalidated by tags on save); the proxy additionally keeps it in
 * memory for a few seconds per instance.
 *
 * Fails CLOSED: on error the last known state is used, and if there is none
 * (cold instance) `null` is returned so the proxy can answer 503 instead of
 * serving a site that may be private or in maintenance.
 */
const TTL_MS = Number(process.env.SITE_STATE_TTL_MS ?? 3000);
/** `next dev` compiles the endpoint on first use, which can take several seconds. */
const FETCH_TIMEOUT_MS = process.env.NODE_ENV === 'production' ? 4000 : 30_000;
const ATTEMPTS = 2;

let cached: { value: SiteState; expires: number } | undefined;
let inflight: Promise<SiteState | null> | undefined;

export function siteStateKey(): Promise<string> {
  return hmacSign(getAuthSecret(), HmacPurpose.SiteState, SITE_STATE_PATH);
}

export async function getSiteState(origin: string): Promise<SiteState | null> {
  if (cached && cached.expires > Date.now()) return cached.value;
  inflight ??= fetchState(origin).finally(() => {
    inflight = undefined;
  });
  return inflight;
}

async function fetchOnce(origin: string): Promise<SiteState> {
  const response = await fetch(new URL(SITE_STATE_PATH, origin), {
    headers: { [SITE_STATE_KEY_HEADER]: await siteStateKey() },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`site-state responded ${response.status}`);
  return (await response.json()) as SiteState;
}

async function fetchState(origin: string): Promise<SiteState | null> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const value = await fetchOnce(origin);
      cached = { value, expires: Date.now() + TTL_MS };
      return value;
    } catch (error) {
      lastError = error;
    }
  }
  console.error('[proxy] could not load site state', lastError);
  // Stale but known is safe; unknown is not.
  return cached?.value ?? null;
}
