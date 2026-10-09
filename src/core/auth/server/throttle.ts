import 'server-only';

import { inArray } from 'drizzle-orm';

import { loginThrottle } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import type { ThrottleKey, ThrottlePolicy } from '@/core/security/throttle';

export {
  isLocked,
  lockSecondsFor,
  recordFailure,
  type ThrottleKey,
  type ThrottlePolicy,
} from '@/core/security/throttle';

/** Sign-in throttling: two keys per attempt, the email and the hashed client IP. */

export const EMAIL_POLICY: ThrottlePolicy = {
  freeAttempts: 5,
  baseLockSeconds: 30,
  maxLockSeconds: 15 * 60,
  resetAfterSeconds: 60 * 60,
};

export const IP_POLICY: ThrottlePolicy = {
  freeAttempts: 20,
  baseLockSeconds: 60,
  maxLockSeconds: 60 * 60,
  resetAfterSeconds: 60 * 60,
};

export function throttleKeys(email: string, ipHash: string | null): ThrottleKey[] {
  const keys: ThrottleKey[] = [
    { key: `email:${email.trim().toLowerCase()}`, policy: EMAIL_POLICY },
  ];
  if (ipHash) keys.push({ key: `ip:${ipHash}`, policy: IP_POLICY });
  return keys;
}

/** Clears the email key after a successful login (IP counters decay on their own). */
export async function recordSuccess(db: Database, keys: ThrottleKey[]): Promise<void> {
  const emailKeys = keys.filter((k) => k.key.startsWith('email:')).map((k) => k.key);
  if (emailKeys.length > 0) {
    await db.delete(loginThrottle).where(inArray(loginThrottle.key, emailKeys));
  }
}
