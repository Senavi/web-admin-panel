import 'server-only';

import { projectConfig } from '@project/config';

import { getAuthSecret } from '@/core/auth/secret';
import { env } from '@/core/env';
import { HmacPurpose, hmacSign, hmacVerify } from '@/core/security/crypto';
import type { ThrottleKey, ThrottlePolicy } from '@/core/security/throttle';

/**
 * Spam protection without third parties: a honeypot field, a signed render
 * timestamp (minimum fill time) and DB-backed rate limits per IP hash and per
 * form. Cloudflare Turnstile is an optional extra (projectConfig.forms).
 */

/** Humans need a few seconds; tokens older than a day are stale. */
export const MIN_FILL_MS = 3000;
export const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;

export const TokenCheck = {
  Ok: 'ok',
  TooFast: 'too-fast',
  Expired: 'expired',
  Invalid: 'invalid',
} as const;
export type TokenCheck = (typeof TokenCheck)[keyof typeof TokenCheck];

export async function issueFormToken(formId: string, now = Date.now()): Promise<string> {
  const issued = String(now);
  return `${issued}.${await hmacSign(getAuthSecret(), HmacPurpose.FormToken, `${formId}.${issued}`)}`;
}

export async function checkFormToken(
  formId: string,
  token: unknown,
  now = Date.now(),
): Promise<TokenCheck> {
  if (typeof token !== 'string') return TokenCheck.Invalid;
  const [issued = '', signature = ''] = token.split('.');
  if (!/^[0-9]{13}$/.test(issued) || !signature) return TokenCheck.Invalid;
  const valid = await hmacVerify(
    getAuthSecret(),
    HmacPurpose.FormToken,
    `${formId}.${issued}`,
    signature,
  );
  if (!valid) return TokenCheck.Invalid;
  const age = now - Number(issued);
  if (age < MIN_FILL_MS) return TokenCheck.TooFast;
  if (age > MAX_TOKEN_AGE_MS) return TokenCheck.Expired;
  return TokenCheck.Ok;
}

/** One visitor: 5 submissions per form per 10 minutes, then exponential lock. */
export const FORM_IP_POLICY: ThrottlePolicy = {
  freeAttempts: 5,
  baseLockSeconds: 10 * 60,
  maxLockSeconds: 6 * 60 * 60,
  resetAfterSeconds: 10 * 60,
};

/** Whole form: protects the inbox and delivery quotas from floods. */
export const FORM_GLOBAL_POLICY: ThrottlePolicy = {
  freeAttempts: 200,
  baseLockSeconds: 5 * 60,
  maxLockSeconds: 60 * 60,
  resetAfterSeconds: 60 * 60,
};

export function formThrottleKeys(formId: string, ipHash: string | null): ThrottleKey[] {
  const keys: ThrottleKey[] = [{ key: `form:${formId}`, policy: FORM_GLOBAL_POLICY }];
  if (ipHash) keys.push({ key: `form:${formId}:ip:${ipHash}`, policy: FORM_IP_POLICY });
  return keys;
}

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Turnstile is on when the project config has a site key and the secret is set. */
export function turnstileEnabled(): boolean {
  return Boolean(projectConfig.forms.turnstile?.siteKey && env().TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(response: unknown, ip: string | null): Promise<boolean> {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (!secret || typeof response !== 'string' || !response) return false;
  const body = new URLSearchParams({ secret, response, ...(ip ? { remoteip: ip } : {}) });
  try {
    const result = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    const json = (await result.json()) as { success?: unknown };
    return json.success === true;
  } catch {
    return false;
  }
}
