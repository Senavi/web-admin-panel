import 'server-only';

import { inArray, sql } from 'drizzle-orm';

import { loginThrottle } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

/**
 * DB-backed login throttling with exponential backoff (works on serverless).
 * Two keys are tracked per attempt: the email and the hashed client IP.
 */
export interface ThrottlePolicy {
  /** Failures allowed before the key is locked. */
  readonly freeAttempts: number;
  readonly baseLockSeconds: number;
  readonly maxLockSeconds: number;
  /** Failure counter resets after this long without failures. */
  readonly resetAfterSeconds: number;
}

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

export interface ThrottleKey {
  readonly key: string;
  readonly policy: ThrottlePolicy;
}

export function throttleKeys(email: string, ipHash: string | null): ThrottleKey[] {
  const keys: ThrottleKey[] = [
    { key: `email:${email.trim().toLowerCase()}`, policy: EMAIL_POLICY },
  ];
  if (ipHash) keys.push({ key: `ip:${ipHash}`, policy: IP_POLICY });
  return keys;
}

/** Lock duration after `failures` consecutive failures (0 when still allowed). */
export function lockSecondsFor(failures: number, policy: ThrottlePolicy): number {
  if (failures < policy.freeAttempts) return 0;
  const exponent = failures - policy.freeAttempts;
  return Math.min(policy.baseLockSeconds * 2 ** exponent, policy.maxLockSeconds);
}

export async function isLocked(
  db: Database,
  keys: ThrottleKey[],
  now = new Date(),
): Promise<boolean> {
  const rows = await db
    .select({ lockedUntil: loginThrottle.lockedUntil })
    .from(loginThrottle)
    .where(
      inArray(
        loginThrottle.key,
        keys.map((k) => k.key),
      ),
    );
  return rows.some((row) => row.lockedUntil !== null && row.lockedUntil > now);
}

/** Records a failure for every key; returns true if any key is now locked. */
export async function recordFailure(
  db: Database,
  keys: ThrottleKey[],
  now = new Date(),
): Promise<boolean> {
  let locked = false;
  for (const { key, policy } of keys) {
    const resetBefore = new Date(now.getTime() - policy.resetAfterSeconds * 1000);
    const [row] = await db
      .insert(loginThrottle)
      .values({ key, failures: 1, lastFailureAt: now })
      .onConflictDoUpdate({
        target: loginThrottle.key,
        set: {
          failures: sql`case when ${loginThrottle.lastFailureAt} < ${resetBefore} then 1 else ${loginThrottle.failures} + 1 end`,
          lastFailureAt: now,
        },
      })
      .returning({ failures: loginThrottle.failures });
    const lockSeconds = lockSecondsFor(row?.failures ?? 1, policy);
    if (lockSeconds > 0) {
      locked = true;
      await db
        .update(loginThrottle)
        .set({ lockedUntil: new Date(now.getTime() + lockSeconds * 1000) })
        .where(inArray(loginThrottle.key, [key]));
    }
  }
  return locked;
}

/** Clears the email key after a successful login (IP counters decay on their own). */
export async function recordSuccess(db: Database, keys: ThrottleKey[]): Promise<void> {
  const emailKeys = keys.filter((k) => k.key.startsWith('email:')).map((k) => k.key);
  if (emailKeys.length > 0) {
    await db.delete(loginThrottle).where(inArray(loginThrottle.key, emailKeys));
  }
}
