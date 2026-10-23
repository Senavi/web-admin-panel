import { describe, expect, it } from 'vitest';

import { describeRemoteContent, hasRemoteContent } from '@/core/database/remote-summary';

const empty = { users: 0, contentRows: 0, items: 0, images: 0, submissions: 0 };

describe('online database summary (Connect Supabase)', () => {
  it('treats a new database as empty', () => {
    expect(hasRemoteContent(empty)).toBe(false);
    expect(describeRemoteContent(empty)).toBe('nothing');
  });

  it('names what is already online', () => {
    const summary = { ...empty, users: 1, contentRows: 34, images: 5 };
    expect(hasRemoteContent(summary)).toBe(true);
    expect(describeRemoteContent(summary)).toBe('1 user, 34 content rows and 5 images');
    expect(describeRemoteContent({ ...empty, submissions: 2 })).toBe('2 form requests');
  });
});
