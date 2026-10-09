import { getTableName, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Role } from '@/core/auth/roles';
import { createUserWithPassword } from '@/core/auth/server/users';
import { appTableNames, copyTables } from '@/core/database/copy';
import {
  collectionItemContent,
  collectionItems,
  collectionSeedLog,
  formSubmissions,
  pageContent,
  users,
} from '@/core/db/schema';
import { runSeed } from '@/core/db/seed';
import type { Database } from '@/core/db/types';

import { createTestDb } from '../support/db';

describe('Connect Supabase: data copy', () => {
  let source: { db: Database; close: () => Promise<void> };
  let target: { db: Database; close: () => Promise<void> };

  beforeAll(async () => {
    source = await createTestDb();
    target = await createTestDb();
    await runSeed(source.db, { seedDevAdmin: false });
    await createUserWithPassword(source.db, {
      email: 'copy@example.com',
      name: 'Copy',
      role: Role.Admin,
      password: 'Maple-Signal-Harbor-73',
      mustChangePassword: false,
    });
    await source.db.insert(formSubmissions).values({
      formId: 'contact',
      locale: 'en',
      data: { name: 'Ada', consent: true },
    });
  });
  afterAll(async () => {
    await source.close();
    await target.close();
  });

  it('copies users, settings, content and media into an empty database', async () => {
    const result = await copyTables(source.db, target.db);
    expect(result[getTableName(users)]).toBe(1);
    expect(result[getTableName(pageContent)]).toBeGreaterThan(0);
    // Seeded blog posts and their content, the seed log and form submissions too.
    expect(result[getTableName(collectionItems)]).toBe(3);
    expect(result[getTableName(collectionItemContent)]).toBeGreaterThan(0);
    expect(result[getTableName(collectionSeedLog)]).toBe(3);
    expect(result[getTableName(formSubmissions)]).toBe(1);
    const copied = await target.db.select().from(users);
    expect(copied[0]?.email).toBe('copy@example.com');
  });

  it('is idempotent', async () => {
    const again = await copyTables(source.db, target.db);
    expect(Object.values(again).every((count) => count === 0)).toBe(true);
  });

  it('can enable row level security on every app table', async () => {
    const tables = appTableNames();
    expect(tables).toEqual(
      expect.arrayContaining([
        'users',
        'page_content',
        'audit_log',
        'analytics_events',
        'collection_items',
        'collection_item_content',
        'collection_slug_redirects',
        'form_submissions',
      ]),
    );
    for (const table of tables)
      await target.db.execute(sql.raw(`alter table "public"."${table}" enable row level security`));
    const [row] = await target.db
      .select({ value: sql<number>`count(*)::int` })
      .from(sql`pg_tables`)
      .where(sql`schemaname = 'public' and rowsecurity = false`);
    expect(row?.value).toBe(0);
  });
});
