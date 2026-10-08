import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { checkPassword, generateTemporaryPassword } from '@/core/auth/password-policy';
import { can, Permission } from '@/core/auth/permissions';
import { Role } from '@/core/auth/roles';
import {
  EMAIL_POLICY,
  isLocked,
  lockSecondsFor,
  recordFailure,
  recordSuccess,
  throttleKeys,
} from '@/core/auth/server/throttle';
import {
  createUserWithPassword,
  PasswordPolicyError,
  revokeAllSessions,
  findUserById,
} from '@/core/auth/server/users';
import type { Database } from '@/core/db/types';
import { safeRedirectPath } from '@/core/project/paths';
import { signGateToken, verifyGateToken } from '@/core/site-gate/token';

import { createTestDb } from '../support/db';

describe('permissions', () => {
  it('gives admins everything', () => {
    for (const permission of Object.values(Permission))
      expect(can(Role.Admin, permission)).toBe(true);
  });
  it('limits managers to overview, pages and their account', () => {
    expect(can(Role.Manager, Permission.PagesEdit)).toBe(true);
    expect(can(Role.Manager, Permission.OverviewView)).toBe(true);
    expect(can(Role.Manager, Permission.SettingsManage)).toBe(false);
    expect(can(Role.Manager, Permission.ManagersManage)).toBe(false);
    expect(can(Role.Manager, Permission.SecurityManage)).toBe(false);
  });
});

describe('password policy', () => {
  it('rejects short, common, repetitive and email-based passwords', () => {
    expect(checkPassword('short').ok).toBe(false);
    expect(checkPassword('qwertyuiop123').ok).toBe(false);
    expect(checkPassword('aaaaaaaaaaaaaaaa').ok).toBe(false);
    expect(checkPassword('jane.doe-secret-2026', { email: 'jane.doe@example.com' }).ok).toBe(false);
  });
  it('accepts a strong passphrase and generated passwords', () => {
    expect(checkPassword('Orbit-Lantern-Quartz-41').ok).toBe(true);
    const generated = generateTemporaryPassword();
    expect(generated).toHaveLength(20);
    expect(checkPassword(generated).ok).toBe(true);
  });
});

describe('safeRedirectPath', () => {
  it('only allows same-origin relative paths', () => {
    expect(safeRedirectPath('/admin/pages', '/admin')).toBe('/admin/pages');
    expect(safeRedirectPath('//evil.com', '/admin')).toBe('/admin');
    expect(safeRedirectPath('https://evil.com', '/admin')).toBe('/admin');
    expect(safeRedirectPath('/\\evil.com', '/admin')).toBe('/admin');
    expect(safeRedirectPath(undefined, '/admin')).toBe('/admin');
  });
});

describe('site-gate token', () => {
  const secret = 'test-secret-that-is-long-enough-0123456789';
  const payload = { uid: 'user-1', role: Role.Admin, v: 0, exp: 2_000_000_000 };

  it('round-trips a valid token', async () => {
    const token = await signGateToken(secret, payload);
    await expect(verifyGateToken(secret, token, 1_000)).resolves.toEqual(payload);
  });
  it('rejects expired, forged and tampered tokens', async () => {
    const token = await signGateToken(secret, payload);
    await expect(verifyGateToken(secret, token, payload.exp)).resolves.toBeNull();
    await expect(
      verifyGateToken('another-secret-that-is-long-enough-012345', token, 1),
    ).resolves.toBeNull();
    const [body, signature] = token.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({ ...payload, role: 'admin', uid: 'x' }),
    ).toString('base64url');
    await expect(verifyGateToken(secret, `${forgedBody}.${signature}`, 1)).resolves.toBeNull();
    await expect(verifyGateToken(secret, `${body}.AAAA`, 1)).resolves.toBeNull();
    await expect(verifyGateToken(secret, 'garbage', 1)).resolves.toBeNull();
    await expect(verifyGateToken(secret, undefined, 1)).resolves.toBeNull();
  });
});

describe('login throttle', () => {
  let db: Database;
  let close: () => Promise<void>;
  beforeAll(async () => {
    ({ db, close } = await createTestDb());
  });
  afterAll(() => close());

  it('computes exponential backoff with a cap', () => {
    expect(lockSecondsFor(4, EMAIL_POLICY)).toBe(0);
    expect(lockSecondsFor(5, EMAIL_POLICY)).toBe(30);
    expect(lockSecondsFor(6, EMAIL_POLICY)).toBe(60);
    expect(lockSecondsFor(50, EMAIL_POLICY)).toBe(EMAIL_POLICY.maxLockSeconds);
  });

  it('locks an email after repeated failures and unlocks on success', async () => {
    const keys = throttleKeys('Someone@Example.com', 'iphash');
    for (let i = 0; i < EMAIL_POLICY.freeAttempts - 1; i += 1) {
      expect(await recordFailure(db, keys)).toBe(false);
    }
    expect(await recordFailure(db, keys)).toBe(true);
    expect(await isLocked(db, throttleKeys('someone@example.com', null))).toBe(true);
    await recordSuccess(db, keys);
    expect(await isLocked(db, throttleKeys('someone@example.com', null))).toBe(false);
  });
});

describe('user management primitives', () => {
  let db: Database;
  let close: () => Promise<void>;
  beforeAll(async () => {
    ({ db, close } = await createTestDb());
  });
  afterAll(() => close());

  it('enforces the password policy when creating users', async () => {
    await expect(
      createUserWithPassword(db, {
        email: 'weak@example.com',
        name: 'Weak',
        role: Role.Manager,
        password: 'password1234',
        mustChangePassword: true,
      }),
    ).rejects.toBeInstanceOf(PasswordPolicyError);
  });

  it('bumps the session version when sessions are revoked', async () => {
    const user = await createUserWithPassword(db, {
      email: 'Mixed.Case@Example.com',
      name: 'Mixed',
      role: Role.Manager,
      password: 'Maple-Signal-Harbor-73',
      mustChangePassword: true,
    });
    expect(user.email).toBe('mixed.case@example.com');
    await revokeAllSessions(db, user.id);
    expect((await findUserById(db, user.id))?.sessionVersion).toBe(1);
  });
});
