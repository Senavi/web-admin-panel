import 'server-only';

import { inArray, sql } from 'drizzle-orm';

import { loginThrottle } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

/**
 * DB-backed throttling with exponential backoff (works on serverless). Used by
 * sign-in (email + IP keys) and form submissions (form + IP keys). Each key has
 * its own policy; counters live in `login_throttle` keyed by a prefixed string.
 */
export interface ThrottlePolicy {
  /** Attempts allowed before the key is locked. */
  readonly freeAttempts: number;
  readonly baseLockSeconds: number;
  readonly maxLockSeconds: number;
  /** Counter resets after this long without attempts. */
  readonly resetAfterSeconds: number;
}

export interface ThrottleKey {
  readonly key: string;
  readonly policy: ThrottlePolicy;
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

/** Records an attempt (a failed sign-in, a form submission) for every key; true if any key is now locked. */
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
          failures: sql`case when ${loginThrottle.lastFailureAt} < ${resetBefore.toISOString()}::timestamptz then 1 else ${loginThrottle.failures} + 1 end`,
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
