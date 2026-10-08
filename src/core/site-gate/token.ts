import { isRole, type Role } from '@/core/auth/roles';
import {
  base64UrlDecode,
  base64UrlEncode,
  HmacPurpose,
  hmacSign,
  hmacVerify,
} from '@/core/security/crypto';

/**
 * Site-gate token: a compact HMAC-signed staff credential stored in an httpOnly
 * cookie. The request proxy verifies it without a database (docs/ARCHITECTURE.md
 * § Site gate). `v` is the user's `sessionVersion`; the proxy rejects tokens whose
 * version no longer matches the active staff list published by /api/site-state.
 */
export const GATE_COOKIE_NAME = 'site_gate';
export const GATE_TOKEN_TTL_SECONDS = 60 * 60 * 12;

export interface GateTokenPayload {
  readonly uid: string;
  readonly role: Role;
  readonly v: number;
  /** Expiry, seconds since epoch. */
  readonly exp: number;
}

export async function signGateToken(secret: string, payload: GateTokenPayload): Promise<string> {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSign(secret, HmacPurpose.GateToken, body);
  return `${body}.${signature}`;
}

export async function verifyGateToken(
  secret: string,
  token: string | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<GateTokenPayload | null> {
  if (!token) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return null;
  if (!(await hmacVerify(secret, HmacPurpose.GateToken, body, signature))) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(base64UrlDecode(body));
  } catch {
    return null;
  }
  if (!isGatePayload(payload) || payload.exp <= nowSeconds) return null;
  return payload;
}

function isGatePayload(value: unknown): value is GateTokenPayload {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.uid === 'string' &&
    isRole(record.role) &&
    typeof record.v === 'number' &&
    typeof record.exp === 'number'
  );
}
