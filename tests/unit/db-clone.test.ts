import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Role } from '@/core/auth/roles';
import { createUserWithPassword } from '@/core/auth/server/users';
import {
  cloneDatabase,
  copyMediaFromUrl,
  expectedMigrations,
  inspectCloneDatabase,
} from '@/core/database/clone';
import {
  type CloneDatabaseState,
  cloneRefusal,
  describeCloneTarget,
  sourceRefusal,
  targetRefusal,
} from '@/core/database/clone-guard';
import { copyTables } from '@/core/database/copy';
import { markDatabaseEnvironment, readDatabaseMarker } from '@/core/database/environment-marker';
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
    // Plain Postgres: a PgBouncer port and the server port are one database.
    const bouncer = 'postgres://app:pw@db.example.com:6432/site';
    expect(databaseIdentity(bouncer)).toBe(databaseIdentity(bouncer.replace(':6432/', ':5432/')));
    expect(databaseIdentity(bouncer)).not.toBe(
      databaseIdentity(bouncer.replace('/site', '/other')),
    );
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

/** PGlite-based tests: creating and migrating databases takes seconds on a small CI machine. */
const DB_TEST = { timeout: 20_000 } as const;

const EMPTY = { users: 0, contentRows: 0, items: 0, images: 0, submissions: 0 };
const LIVE: CloneDatabaseState = {
  marker: 'production',
  migrations: 9,
  missingTables: [],
  hasSettings: true,
  summary: { ...EMPTY, users: 2, contentRows: 40, images: 5 },
};
const NEW_DB: CloneDatabaseState = {
  marker: null,
  migrations: 0,
  missingTables: ['users'],
  hasSettings: false,
  summary: EMPTY,
};
const sourceOptions = { expectedMigrations: 9, allowAnySource: false };

describe('db:clone markers (D-098)', DB_TEST, () => {
  it('requires a migrated, non-empty source marked production', () => {
    expect(sourceRefusal(LIVE, sourceOptions)).toBeNull();
    expect(sourceRefusal(NEW_DB, sourceOptions)).toMatch(/not migrated/);
    expect(sourceRefusal({ ...LIVE, migrations: 8 }, sourceOptions)).toMatch(/8\/9/);
    expect(sourceRefusal({ ...LIVE, summary: EMPTY }, sourceOptions)).toMatch(/no users/);
    expect(sourceRefusal({ ...LIVE, hasSettings: false }, sourceOptions)).toMatch(/no users/);
    expect(sourceRefusal({ ...LIVE, marker: 'staging' }, sourceOptions)).toMatch(
      /marked staging.*--allow-any-source/,
    );
    expect(sourceRefusal({ ...LIVE, marker: null }, sourceOptions)).toMatch(/unknown/);
    expect(
      sourceRefusal({ ...LIVE, marker: null }, { ...sourceOptions, allowAnySource: true }),
    ).toBeNull();
    // --allow-any-source never accepts an empty or unmigrated source.
    expect(sourceRefusal(NEW_DB, { ...sourceOptions, allowAnySource: true })).toMatch(
      /not migrated/,
    );
  });

  it('never overwrites production; an unmarked target only when it is empty', () => {
    expect(targetRefusal(LIVE)).toMatch(/live site's database/);
    expect(targetRefusal({ ...LIVE, marker: 'staging' })).toBeNull();
    expect(targetRefusal(NEW_DB)).toBeNull();
    expect(targetRefusal({ ...LIVE, marker: null })).toMatch(/not marked as staging/);
    expect(targetRefusal({ ...LIVE, marker: 'development' })).toMatch(/marked development/);
  });

  it('names what will be replaced', () => {
    expect(describeCloneTarget({ ...LIVE, marker: 'staging' })).toBe(
      'staging: 2 users, 40 content rows and 5 images will be replaced',
    );
    expect(describeCloneTarget(NEW_DB)).toBe('new database: empty, nothing to replace');
  });

  it('a production marker is sticky on its own database, not on a copy of it', async () => {
    const { db, close } = await createTestDb();
    const environment = async () => (await readDatabaseMarker(db))?.environment;
    try {
      expect(await markDatabaseEnvironment(db, 'development', 'db/a')).toBeNull();
      expect(await readDatabaseMarker(db)).toBeNull();
      await markDatabaseEnvironment(db, 'staging', 'db/a');
      expect(await environment()).toBe('staging');
      await markDatabaseEnvironment(db, 'production', 'db/a');
      // A staging deploy pointed at the live database: the marker stays.
      expect(await markDatabaseEnvironment(db, 'staging', 'db/a')).toMatch(/WARNING/);
      expect(await markDatabaseEnvironment(db, 'staging', null)).toMatch(/WARNING/);
      expect(await environment()).toBe('production');
      // Neon "Reset from parent" / a restored backup: production's marker on another database.
      expect(await markDatabaseEnvironment(db, 'staging', 'db/b')).toBe(
        'marked staging (was production)',
      );
      expect(await readDatabaseMarker(db)).toEqual({ environment: 'staging', identity: 'db/b' });
    } finally {
      await close();
    }
  });
});

describe('cloneDatabase', DB_TEST, () => {
  let source: { db: Database; close: () => Promise<void> };
  let target: { db: Database; close: () => Promise<void> };

  beforeAll(async () => {
    source = await createTestDb();
    target = await createTestDb();
    await runSeed(source.db, { seedDevAdmin: false });
    await markDatabaseEnvironment(source.db, 'production', 'prod/db');
    await markDatabaseEnvironment(target.db, 'staging', 'staging/db');
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

  it('inspects both databases', async () => {
    const live = await inspectCloneDatabase(source.db);
    expect(live.marker).toBe('production');
    expect(live.migrations).toBe(expectedMigrations());
    expect(
      sourceRefusal(live, { expectedMigrations: expectedMigrations(), allowAnySource: false }),
    ).toBeNull();
    const staging = await inspectCloneDatabase(target.db);
    expect(staging.marker).toBe('staging');
    expect(staging.summary.users).toBe(1);
    expect(targetRefusal(staging)).toBeNull();
  });

  it('a failure mid-copy rolls back: the target stays as it was', async () => {
    await expect(
      cloneDatabase(source.db, target.db, {
        targetIdentity: 'staging/db',
        copy: async (from, to) => {
          await copyTables(from, to);
          throw new Error('connection lost');
        },
      }),
    ).rejects.toThrow('connection lost');
    const emails = (await target.db.select({ email: users.email }).from(users)).map((u) => u.email);
    expect(emails).toEqual(['old-staging@example.com']);
  });

  it('refuses a target marked production inside the transaction', async () => {
    const live = await createTestDb();
    try {
      await markDatabaseEnvironment(live.db, 'production', 'prod/db');
      await createUserWithPassword(live.db, {
        email: 'client@example.com',
        name: 'Client',
        role: Role.Admin,
        password: 'Maple-Signal-Harbor-73',
        mustChangePassword: false,
      });
      await expect(
        cloneDatabase(target.db, live.db, { targetIdentity: 'other/db' }),
      ).rejects.toThrow(/live site/);
      expect((await live.db.select().from(users)).length).toBe(1);
    } finally {
      await live.close();
    }
  });

  it('replaces the target content with the source content', async () => {
    await cloneDatabase(source.db, target.db, { targetIdentity: 'staging/db' });
    expect(await readDatabaseMarker(target.db)).toEqual({
      environment: 'staging',
      identity: 'staging/db',
    });
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
