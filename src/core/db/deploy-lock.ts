import type { Sql } from 'postgres';

/**
 * Deploy lock (D-097): `db:migrate:deploy` holds a Postgres session advisory lock
 * while it migrates and prepares the database, so two deploys of the same
 * environment never run migrations or `content:sync` at the same time; the
 * second waits. Session locks need a real session: take it over the direct
 * connection (`migrationUrl()`), never through a transaction pooler.
 */

/** Advisory lock id (any 64-bit integer; constant for every project on this template). */
export const DEPLOY_LOCK_ID = 7_303_571_102_118_011n;
/** How long a deploy waits for another deploy of the same database. */
export const DEPLOY_LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_MS = 3000;

export interface LockClock {
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
}

const realClock: LockClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Tries `tryLock` until it succeeds or `timeoutMs` passes. Calls `onWait` once,
 * on the first failed attempt (for the build log). Returns whether it got the lock.
 */
export async function acquireLock(
  tryLock: () => Promise<boolean>,
  options: {
    readonly timeoutMs?: number;
    readonly pollMs?: number;
    readonly onWait?: () => void;
    readonly clock?: LockClock;
  } = {},
): Promise<boolean> {
  const { timeoutMs = DEPLOY_LOCK_TIMEOUT_MS, pollMs = POLL_MS, clock = realClock } = options;
  const deadline = clock.now() + timeoutMs;
  let waited = false;
  for (;;) {
    if (await tryLock()) return true;
    if (!waited) {
      waited = true;
      options.onWait?.();
    }
    if (clock.now() + pollMs > deadline) return false;
    await clock.sleep(pollMs);
  }
}

/** A postgres-js session, as returned by `openSession` (direct connection). */
type Session = Sql;

/** One `pg_try_advisory_lock` attempt on the deploy lock (session level). */
export async function tryDeployLock(session: Session): Promise<boolean> {
  const rows = await session<
    Array<{ locked: boolean }>
  >`select pg_try_advisory_lock(${DEPLOY_LOCK_ID.toString()}::bigint) as locked`;
  return rows[0]?.locked === true;
}

export async function releaseDeployLock(session: Session): Promise<void> {
  await session`select pg_advisory_unlock(${DEPLOY_LOCK_ID.toString()}::bigint)`;
}
