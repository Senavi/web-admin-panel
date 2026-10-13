import { hkdfSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { DATA_DIR } from '@/core/db/paths';
import { isPreviewMode } from '@/core/preview/mode';

/**
 * Returns the secret that signs sessions, the site-gate cookie and internal
 * requests. Order:
 * 1. `AUTH_SECRET` when set (always supported, recommended for long-lived sites).
 * 2. Development/test: a random secret generated once into `.data/dev-auth-secret`
 *    (never derived from anything else).
 * 3. Production: derived with HKDF-SHA256 from `SUPABASE_SERVICE_ROLE_KEY`, so a
 *    Supabase deploy needs no extra variable. Rotating the service key changes
 *    the secret and signs everyone out.
 * 4. Preview mode (no database): a fixed, public key. Nothing secret depends on
 *    it there: no accounts, sessions, forms or private content exist (D-079).
 *
 * Not marked `server-only` because the request proxy (Node.js runtime) uses it
 * to verify the site-gate cookie. Never import it from client components.
 */
const DEV_SECRET_FILE = path.join(DATA_DIR, 'dev-auth-secret');
/** HKDF `info` label; changing it signs everyone out on sites without AUTH_SECRET. */
export const AUTH_SECRET_HKDF_INFO = 'site-starter/auth-secret/v1';
const DERIVED_SECRET_BYTES = 48;
const PREVIEW_MODE_SECRET = 'site-starter/preview-mode/no-secrets-here';

let cached: string | undefined;

/** HKDF-SHA256 of the Supabase service role key (48 bytes, base64url). */
export function deriveAuthSecret(serviceRoleKey: string): string {
  return Buffer.from(
    hkdfSync('sha256', serviceRoleKey, '', AUTH_SECRET_HKDF_INFO, DERIVED_SECRET_BYTES),
  ).toString('base64url');
}

export function getAuthSecret(): string {
  if (cached) return cached;
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) return (cached = fromEnv);
  if (process.env.NODE_ENV !== 'production') return (cached = devSecret());
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRoleKey) return (cached = deriveAuthSecret(serviceRoleKey));
  if (isPreviewMode()) return (cached = PREVIEW_MODE_SECRET);
  throw new Error('AUTH_SECRET (or SUPABASE_SERVICE_ROLE_KEY) is required in production.');
}

function devSecret(): string {
  if (fs.existsSync(DEV_SECRET_FILE)) return fs.readFileSync(DEV_SECRET_FILE, 'utf8').trim();
  const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString('base64url');
  fs.mkdirSync(path.dirname(DEV_SECRET_FILE), { recursive: true });
  fs.writeFileSync(DEV_SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}

/** Where the secret comes from (Security page, developer mode). */
export function authSecretSource(): 'env' | 'derived' | 'development' | 'preview' {
  if (process.env.AUTH_SECRET?.trim()) return 'env';
  if (process.env.NODE_ENV !== 'production') return 'development';
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? 'derived' : 'preview';
}
