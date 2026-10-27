import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Role } from '@/core/auth/roles';
import { createUserWithPassword } from '@/core/auth/server/users';
import { cloneDatabase, copyMediaFromUrl } from '@/core/database/clone';
import { cloneRefusal } from '@/core/database/clone-guard';
import { databaseIdentity } from '@/core/db/connection-info';
import { media, pageContent, users } from '@/core/db/schema';
import { runSeed } from '@/core/db/seed';
import type { Database } from '@/core/db/types';

import { createTestDb } from '../support/db';
import { memoryStorage } from '../support/storage';

const PROD = 'postgresql://u:p@ep-prod-1-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const PROD_DIRECT = PROD.replace('-pooler.', '.');
const STAGING = 'postgresql://u:p@ep-staging-2-pooler.eu-central-1.aws.neon.tech/neondb';

describe('db:clone refusals', () => {
  it('knows the same database behind pooled and direct URLs', () => {
    expect(databaseIdentity(PROD)).toBe(databaseIdentity(PROD_DIRECT));
    expect(databaseIdentity(PROD)).not.toBe(databaseIdentity(STAGING));
    const tx =
      'postgresql://postgres.abcdefghijklmnopqrst:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
    expect(databaseIdentity(tx)).toBe(databaseIdentity(tx.replace(':6543/', ':5432/')));
  });

  it('refuses a missing argument, the same database, this setup’s production and deploys', () => {
    expect(cloneRefusal({ from: PROD, to: undefined, env: {} })).toMatch(/Usage/);
    expect(cloneRefusal({ from: PROD, to: PROD_DIRECT, env: {} })).toMatch(/onto itself/);
    expect(cloneRefusal({ from: STAGING, to: PROD, env: { DATABASE_URL: PROD_DIRECT } })).toMatch(
      /this setup's DATABASE_URL/,
    );
    expect(cloneRefusal({ from: PROD, to: STAGING, env: { NETLIFY: 'true' } })).toMatch(/deploy/);
    expect(cloneRefusal({ from: PROD, to: STAGING, env: { CI: 'true' } })).toMatch(/CI/);
    expect(cloneRefusal({ from: PROD, to: STAGING, env: { DATABASE_URL: PROD } })).toBeNull();
    // On a staging setup, its own database is the expected target.
    expect(
      cloneRefusal({
        from: PROD,
        to: STAGING,
        env: { DATABASE_URL: STAGING, DEPLOYMENT_ENVIRONMENT: 'staging' },
      }),
    ).toBeNull();
    // Messages never show passwords.
    expect(cloneRefusal({ from: PROD, to: PROD_DIRECT, env: {} })).not.toContain(':p@');
  });

  it('the script refuses before connecting anywhere', () => {
    const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: PROD };
    delete env.NODE_OPTIONS;
    const result = spawnSync(
      process.execPath,
      [
        path.resolve('node_modules/tsx/dist/cli.mjs'),
        '--conditions=react-server',
        'scripts/db-clone.ts',
        '--from',
        STAGING,
        '--to',
        PROD_DIRECT,
        '--yes',
      ],
      { env, encoding: 'utf8', timeout: 60_000 },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Refusing to overwrite/);
  }, 60_000);
});

describe('cloneDatabase', () => {
  let source: { db: Database; close: () => Promise<void> };
  let target: { db: Database; close: () => Promise<void> };

  beforeAll(async () => {
    source = await createTestDb();
    target = await createTestDb();
    await runSeed(source.db, { seedDevAdmin: false });
    await createUserWithPassword(source.db, {
      email: 'prod@example.com',
      name: 'Prod',
      role: Role.Admin,
      password: 'Maple-Signal-Harbor-73',
      mustChangePassword: false,
    });
    await createUserWithPassword(target.db, {
      email: 'old-staging@example.com',
      name: 'Old',
      role: Role.Admin,
      password: 'Maple-Signal-Harbor-73',
      mustChangePassword: false,
    });
  }, 60_000);
  afterAll(async () => {
    await source.close();
    await target.close();
  });

  it('replaces the target content with the source content', async () => {
    await cloneDatabase(source.db, target.db);
    const emails = (await target.db.select({ email: users.email }).from(users)).map((u) => u.email);
    expect(emails).toEqual(['prod@example.com']);
    expect((await target.db.select().from(pageContent)).length).toBe(
      (await source.db.select().from(pageContent)).length,
    );
  });

  it('copies media files from the source URL into the target storage', async () => {
    const storage = memoryStorage();
    const rows = await target.db.select().from(media);
    expect(rows.length).toBeGreaterThan(0);
    const result = await copyMediaFromUrl(
      target.db,
      'https://prod.example.com/media',
      storage,
      async (url) =>
        String(url).endsWith(rows[0]!.storageKey)
          ? new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/webp' } })
          : new Response(null, { status: 404 }),
    );
    expect(result.copied).toBe(1);
    expect(storage.files.has(rows[0]!.storageKey)).toBe(true);
  });
});
