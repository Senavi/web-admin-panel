import { describe, expect, it } from 'vitest';

import { Role, UserStatus } from '@/core/auth/roles';
import { maskEnvValue } from '@/core/security/env-catalog';
import { userChangeViolation } from '@/core/users/guards';

const admin = { id: 'a', role: Role.Admin, status: UserStatus.Active } as const;
const manager = { id: 'm', role: Role.Manager, status: UserStatus.Active } as const;

describe('user guards', () => {
  it('forbids deleting, disabling or demoting yourself', () => {
    expect(
      userChangeViolation({ type: 'delete' }, { actorId: 'a', target: admin, activeAdmins: 2 }),
    ).toMatch(/your own/);
    expect(
      userChangeViolation(
        { type: 'status', status: UserStatus.Disabled },
        { actorId: 'a', target: admin, activeAdmins: 2 },
      ),
    ).toMatch(/your own/);
    expect(
      userChangeViolation(
        { type: 'role', role: Role.Manager },
        { actorId: 'a', target: admin, activeAdmins: 2 },
      ),
    ).toMatch(/your own/);
  });

  it('protects the last active admin', () => {
    const ctx = { actorId: 'other', target: admin, activeAdmins: 1 };
    expect(userChangeViolation({ type: 'delete' }, ctx)).toMatch(/last active admin/);
    expect(userChangeViolation({ type: 'status', status: UserStatus.Disabled }, ctx)).toMatch(
      /last active admin/,
    );
    expect(userChangeViolation({ type: 'role', role: Role.Manager }, ctx)).toMatch(
      /last active admin/,
    );
  });

  it('allows normal changes', () => {
    expect(
      userChangeViolation({ type: 'delete' }, { actorId: 'a', target: manager, activeAdmins: 1 }),
    ).toBeNull();
    expect(
      userChangeViolation(
        { type: 'role', role: Role.Admin },
        { actorId: 'a', target: manager, activeAdmins: 1 },
      ),
    ).toBeNull();
    expect(
      userChangeViolation(
        { type: 'status', status: UserStatus.Disabled },
        { actorId: 'x', target: admin, activeAdmins: 2 },
      ),
    ).toBeNull();
  });
});

describe('env masking', () => {
  it('never reveals full secrets or URL credentials', () => {
    expect(maskEnvValue('super-secret-value-1234', true)).toBe('••••1234');
    expect(maskEnvValue('short', true)).toBe('••••');
    expect(maskEnvValue('postgres://user:pw@db.example.com:5432/x', true)).toBe(
      'postgres://****:****@db.example.com:5432/x',
    );
    expect(maskEnvValue('https://example.com', false)).toBe('https://example.com');
  });
});
