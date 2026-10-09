import 'server-only';

import { parseEnv, type Env } from './env-schema';

export { MailProvider, StorageDriver, resolveStorageDriver, type Env } from './env-schema';

let cached: Env | undefined;

/**
 * Validated server environment. Parsed once per process; throws with a readable
 * message listing every invalid variable. Called from `instrumentation.ts` so a
 * misconfigured deployment fails at startup instead of on first request.
 */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

export function isProduction(): boolean {
  return env().NODE_ENV === 'production';
}
