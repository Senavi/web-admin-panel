import { getAuthSecret } from '@/core/auth/secret';
import { HmacPurpose, hmacSign } from '@/core/security/crypto';

import {
  SITE_STATE_KEY_HEADER,
  SITE_STATE_PATH,
  SITE_STATE_VERSION_MAX_AGE_SECONDS,
  type SiteState,
} from './state';

/**
 * Proxy-side access to the site state. The state endpoint is cached on the
 * server (and invalidated by tags on save); the proxy keeps the last state in
 * memory per instance and serves it STALE-WHILE-REVALIDATE: a request never
 * waits for a refresh, which runs in the background once the state is older
 * than `SITE_STATE_TTL_MS` (default 15 s; 60 s in development).
 *
 * Changes therefore reach other visitors within the TTL (+ one request). The
 * person who made a change carries a `site-state-v` cookie with its time; a
 * cached state older than that is reloaded before answering them.
 *
 * Fails CLOSED: a cold instance waits for the first state, and if it can't be
 * loaded `null` is returned so the proxy can answer 503 instead of serving a
 * site that may be private or in maintenance.
 */
const DEFAULT_TTL_MS = process.env.NODE_ENV === 'production' ? 15_000 : 60_000;
const TTL_MS = Number(process.env.SITE_STATE_TTL_MS ?? DEFAULT_TTL_MS);
/** `next dev` compiles the endpoint on first use, which can take several seconds. */
const FETCH_TIMEOUT_MS = process.env.NODE_ENV === 'production' ? 4000 : 30_000;
const ATTEMPTS = 2;
/** A version cookie from the future (clock skew aside) is ignored. */
const MAX_CLOCK_SKEW_MS = 5000;

let cached: { value: SiteState; fetchedAt: number } | undefined;
let inflight: Promise<SiteState | null> | undefined;

export function siteStateKey(): Promise<string> {
  return hmacSign(getAuthSecret(), HmacPurpose.SiteState, SITE_STATE_PATH);
}

/** Parses the `site-state-v` cookie: a recent change time, or 0. */
export function parseStateVersion(value: string | undefined, now = Date.now()): number {
  const time = Number(value);
  if (!Number.isFinite(time) || time <= 0) return 0;
  if (time > now + MAX_CLOCK_SKEW_MS) return 0;
  if (time < now - SITE_STATE_VERSION_MAX_AGE_SECONDS * 1000) return 0;
  return time;
}

/**
 * The site state for this request. `changedAt` (from the version cookie) forces
 * a reload when the cached state predates the caller's own change.
 */
export async function getSiteState(
  origin: string,
  options: { readonly changedAt?: number } = {},
): Promise<SiteState | null> {
  const now = Date.now();
  if (cached && (options.changedAt ?? 0) <= cached.fetchedAt) {
    if (now - cached.fetchedAt >= TTL_MS) void refresh(origin); // background, never awaited
    return cached.value;
  }
  return refresh(origin);
}

function refresh(origin: string): Promise<SiteState | null> {
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
    const startedAt = Date.now();
    try {
      const value = await fetchOnce(origin);
      cached = { value, fetchedAt: startedAt };
      return value;
    } catch (error) {
      lastError = error;
    }
  }
  console.error('[proxy] could not load site state', lastError);
  // Stale but known is safe; unknown is not.
  return cached?.value ?? null;
}
