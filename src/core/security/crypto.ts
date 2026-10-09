/**
 * Small Web Crypto helpers usable in every runtime (Node.js, proxy, edge).
 */
const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlEncode(value: string): string {
  return toBase64Url(encoder.encode(value));
}

function base64UrlDecodeBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function base64UrlDecode(value: string): string {
  return new TextDecoder().decode(base64UrlDecodeBytes(value));
}

const keyCache = new Map<string, Promise<CryptoKey>>();

/** HMAC key derived from the app secret and a purpose label (domain separation). */
function hmacKey(secret: string, purpose: string): Promise<CryptoKey> {
  const cacheKey = `${purpose}:${secret}`;
  let key = keyCache.get(cacheKey);
  if (!key) {
    key = crypto.subtle.importKey(
      'raw',
      encoder.encode(`${purpose}\u0000${secret}`),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
    keyCache.set(cacheKey, key);
  }
  return key;
}

export async function hmacSign(secret: string, purpose: string, data: string): Promise<string> {
  const key = await hmacKey(secret, purpose);
  return toBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

/** Constant-time verification (delegated to Web Crypto). */
export async function hmacVerify(
  secret: string,
  purpose: string,
  data: string,
  signature: string,
): Promise<boolean> {
  const key = await hmacKey(secret, purpose);
  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = base64UrlDecodeBytes(signature);
  } catch {
    return false;
  }
  return crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(data));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const HmacPurpose = {
  GateToken: 'site-gate-token',
  SiteState: 'site-state-request',
  IpHash: 'ip-hash',
  FormToken: 'form-timing-token',
} as const;
