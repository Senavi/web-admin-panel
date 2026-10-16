import { describe, expect, it } from 'vitest';

import {
  PENDING_PASSWORD_SESSION_SECONDS,
  pendingSessionExpired,
} from '@/core/auth/server/pending-password';

describe('pending-password session lifetime', () => {
  const now = Date.UTC(2026, 9, 16, 12, 0, 0);

  it('lasts about 30 minutes from sign-in', () => {
    expect(PENDING_PASSWORD_SESSION_SECONDS).toBe(1800);
    expect(pendingSessionExpired(now - 29 * 60_000, now)).toBe(false);
    expect(pendingSessionExpired(now - 31 * 60_000, now)).toBe(true);
  });

  it('accepts dates, strings and timestamps', () => {
    expect(pendingSessionExpired(new Date(now - 60 * 60_000), now)).toBe(true);
    expect(pendingSessionExpired(new Date(now - 1000).toISOString(), now)).toBe(false);
  });
});
