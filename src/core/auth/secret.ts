import fs from 'node:fs';
import path from 'node:path';

import { DATA_DIR } from '@/core/db/paths';

/**
 * Returns AUTH_SECRET. In development without one, a random secret is generated
 * once into `.data/dev-auth-secret` so zero-config development works and
 * sessions survive restarts. Production requires AUTH_SECRET (validated by env).
 *
 * Not marked `server-only` because the request proxy (Node.js runtime) uses it
 * to verify the site-gate cookie. Never import it from client components.
 */
const DEV_SECRET_FILE = path.join(DATA_DIR, 'dev-auth-secret');

let cached: string | undefined;

export function getAuthSecret(): string {
  if (cached) return cached;
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) return (cached = fromEnv);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is required in production.');
  }
  if (fs.existsSync(DEV_SECRET_FILE)) {
    return (cached = fs.readFileSync(DEV_SECRET_FILE, 'utf8').trim());
  }
  const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString('base64url');
  fs.mkdirSync(path.dirname(DEV_SECRET_FILE), { recursive: true });
  fs.writeFileSync(DEV_SECRET_FILE, secret, { mode: 0o600 });
  return (cached = secret);
}
