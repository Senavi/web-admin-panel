import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { projectConfig } from '@project/config';

import { migratePostgres, openPostgres } from '@/core/db/drivers/postgres';
import { describeDatabase } from '@/core/db/info';
import { settings, settingsLocalized } from '@/core/db/schema';
import { runSeed } from '@/core/db/seed';
import type { Database } from '@/core/db/types';
import { siteSettingsSchema } from '@/core/settings/schema';

import { createTestDb } from '../support/db';

describe('database (PGlite)', () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
  });
  afterAll(() => close());

  it('applies migrations', async () => {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sql`information_schema.tables`)
      .where(sql`table_schema = 'public'`);
    expect(result?.count).toBeGreaterThanOrEqual(18);
  });

  it('seeds default settings idempotently without overwriting', async () => {
    await runSeed(db, { seedDevAdmin: false });
    const [row] = await db.select().from(settings);
    const parsed = siteSettingsSchema.parse(row?.data);
    expect(parsed.general.enabledLocales).toEqual([...projectConfig.localeCodes]);
    expect(parsed.status.indexing).toBe(true);

    const edited = { ...parsed, general: { ...parsed.general, siteName: 'Edited' } };
    await db.update(settings).set({ data: edited }).where(eq(settings.id, 1));
    await runSeed(db, { seedDevAdmin: false });

    const [after] = await db.select().from(settings);
    expect(siteSettingsSchema.parse(after?.data).general.siteName).toBe('Edited');
    const localized = await db.select().from(settingsLocalized);
    expect(localized.map((r) => r.locale).sort()).toEqual([...projectConfig.localeCodes].sort());
  });

  it('enforces the settings singleton', async () => {
    await expect(db.insert(settings).values({ id: 2, data: {} })).rejects.toThrow();
  });
});

describe('database (postgres-js driver over the Postgres wire protocol)', () => {
  let pg: PGlite;
  let server: PGLiteSocketServer;
  let url: string;

  beforeAll(async () => {
    pg = await PGlite.create();
    server = new PGLiteSocketServer({ db: pg, port: 0, host: '127.0.0.1' });
    await server.start();
    const address = server.getServerConn();
    url = `postgres://postgres:postgres@${address}/postgres`;
  });
  afterAll(async () => {
    await server.stop();
    await pg.close();
  });

  it('migrates and queries through postgres-js', async () => {
    await migratePostgres(url);
    const { db, close } = openPostgres(url, { max: 1 });
    try {
      await runSeed(db, { seedDevAdmin: false });
      const rows = await db.select().from(settings);
      expect(rows).toHaveLength(1);
    } finally {
      await close();
    }
  });
});

describe('describeDatabase', () => {
  it('reports local mode without a URL and strips credentials otherwise', () => {
    expect(describeDatabase(undefined)).toEqual({ mode: 'local', host: null });
    expect(describeDatabase('postgres://u:secret@db.example.com:6543/postgres')).toEqual({
      mode: 'postgres',
      host: 'db.example.com:6543',
    });
  });
});
