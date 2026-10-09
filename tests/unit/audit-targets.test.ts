import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { Database } from '@/core/db/types';
import { describeAuditTargets } from '@/core/security/audit-targets';

const USER_ID = 'f5855cf3-0000-4000-8000-000000000001';

function fakeDb(rows: Array<{ id: string; name: string; email: string }>): Database {
  const where = vi.fn().mockResolvedValue(rows);
  return { select: () => ({ from: () => ({ where }) }) } as unknown as Database;
}

describe('audit target labels', () => {
  it('replaces ids with names and page labels', async () => {
    const labels = await describeAuditTargets(
      fakeDb([{ id: USER_ID, name: 'Ada', email: 'ada@example.com' }]),
      [`user:${USER_ID}`, 'user:gone', 'page:home:uk', null].map((target) => ({ target })),
    );
    expect(labels.get(`user:${USER_ID}`)).toBe('Ada (ada@example.com)');
    expect(labels.get('user:gone')).toBe('Deleted user');
    expect(labels.get('page:home:uk')).toBe('Home (uk)');
  });
});
