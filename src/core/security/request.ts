import { getAuthSecret } from '@/core/auth/secret';

import { HmacPurpose, hmacSign } from './crypto';

/**
 * Client IP from platform headers. Vercel and Netlify set `x-forwarded-for`
 * (left-most entry is the client) and their own headers; locally it may be absent.
 */
export function getClientIp(headers: Headers): string | null {
  const candidates = [
    headers.get('x-nf-client-connection-ip'),
    headers.get('x-real-ip'),
    headers.get('x-forwarded-for')?.split(',')[0],
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  return null;
}

/** Keyed hash of an IP address. Raw IPs are never stored. */
export async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  return (await hmacSign(getAuthSecret(), HmacPurpose.IpHash, ip)).slice(0, 32);
}
