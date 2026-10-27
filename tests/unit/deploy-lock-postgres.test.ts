import { afterAll, describe, expect, it } from 'vitest';

import { acquireLock, releaseDeployLock, tryDeployLock } from '@/core/db/deploy-lock';
import { openSession } from '@/core/db/drivers/postgres';

/**
 * The deploy lock against a real Postgres (CI sets TEST_POSTGRES_URL; PGlite has a
 * single session, so locks can't be tested there).
 */
const url = process.env.TEST_POSTGRES_URL;

describe.skipIf(!url)('deploy lock on Postgres', () => {
  const first = openSession(url ?? '');
  const second = openSession(url ?? '');
  afterAll(async () => {
    await first.end({ timeout: 2 });
    await second.end({ timeout: 2 });
  });

  it('a second deploy waits while the first holds the lock, then takes it', async () => {
    expect(await tryDeployLock(first)).toBe(true);
    let waited = false;
    const blocked = await acquireLock(() => tryDeployLock(second), {
      timeoutMs: 1500,
      pollMs: 300,
      onWait: () => (waited = true),
    });
    expect(blocked).toBe(false);
    expect(waited).toBe(true);

    await releaseDeployLock(first);
    expect(await acquireLock(() => tryDeployLock(second), { timeoutMs: 1500, pollMs: 300 })).toBe(
      true,
    );
    await releaseDeployLock(second);
  });

  it('ending a session releases its lock (a crashed deploy never blocks the next one)', async () => {
    const crashed = openSession(url ?? '');
    expect(await tryDeployLock(crashed)).toBe(true);
    await crashed.end({ timeout: 2 });
    expect(await tryDeployLock(first)).toBe(true);
    await releaseDeployLock(first);
  });
});
