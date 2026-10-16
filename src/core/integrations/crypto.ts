import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for integration credentials stored in the database. The key is
 * derived with HKDF-SHA256 from the auth secret (`AUTH_SECRET`, or the value
 * derived from the Supabase service key) with its own `info` label, so it is
 * independent from the key that signs sessions. Each value gets a random IV and
 * is bound to its name (additional authenticated data), so a ciphertext cannot
 * be moved to another slot. A rotated auth secret makes stored values
 * unreadable: `decryptSecret` returns null and the admin asks to re-enter them.
 */
export const SECRETS_HKDF_INFO = 'site-starter/integration-secrets/v1';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';

function deriveKey(authSecret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', authSecret, '', SECRETS_HKDF_INFO, KEY_BYTES));
}

export function encryptSecret(authSecret: string, name: string, value: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, deriveKey(authSecret), iv);
  cipher.setAAD(Buffer.from(name));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), encrypted]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

/** The plain value, or null when it cannot be read (wrong key, wrong name, damaged). */
export function decryptSecret(authSecret: string, name: string, token: string): string | null {
  try {
    const [version, iv, tag, encrypted] = token.split('.');
    if (version !== VERSION || !iv || !tag || !encrypted) return null;
    const decipher = createDecipheriv(
      ALGORITHM,
      deriveKey(authSecret),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAAD(Buffer.from(name));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

/** `••••1234` for values long enough to show a tail safely, `••••` otherwise. */
export function secretHint(value: string): string {
  return value.length >= 12 ? `••••${value.slice(-4)}` : '••••';
}
