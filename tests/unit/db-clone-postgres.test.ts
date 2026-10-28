import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Role } from '@/core/auth/roles';
import { createUserWithPassword } from '@/core/auth/server/users';
import { cloneDatabase } from '@/core/database/clone';
import { markDatabaseEnvironment, readDatabaseMarker } from '@/core/database/environment-marker';
import { copyTables } from '@/core/database/copy';
import { databaseIdentity } from '@/core/db/connection-info';
import { migratePostgres, openPostgres, type PostgresConnection } from '@/core/db/drivers/postgres';
import { users } from '@/core/db/schema';
import { runSeed } from '@/core/db/seed';

import { runScriptFile } from '../support/script';

/**
 * `db:clone` against a real Postgres (CI sets TEST_POSTGRES_URL): the script as a
 * developer runs it, with no DATABASE_URL on the computer. Creates its own
 * databases next to the one in TEST_POSTGRES_URL and drops them afterwards.
 */
const url = process.env.TEST_POSTGRES_URL;
const SUFFIX = `${process.pid}_${Date.now()}`;
const NAMES = {
  production: `clone_prod_${SUFFIX}`,
  staging: `clone_staging_${SUFFIX}`,
  fresh: `clone_fresh_${SUFFIX}`,
  unmigrated: `clone_unmigrated_${SUFFIX}`,
};

function databaseUrl(name: string): string {
  const parsed = new URL(url ?? 'postgres://localhost/x');
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

function runClone(from: string, to: string): { status: number | null; output: string } {
  const result = runScriptFile('scripts/db-clone.ts', ['--from', from, '--to', to, '--yes']);
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

async function emails(connection: PostgresConnection): Promise<string[]> {
  return (await connection.db.select({ email: users.email }).from(users))
    .map((row) => row.email)
    .sort();
}

describe.skipIf(!url)('db:clone on Postgres', () => {
  const admin = postgres(url ?? '', { max: 1, onnotice: () => undefined });
  const open: PostgresConnection[] = [];
  let production: PostgresConnection;
  let staging: PostgresConnection;

  beforeAll(async () => {
    for (const name of Object.values(NAMES)) await admin.unsafe(`CREATE DATABASE "${name}"`);
    for (const name of [NAMES.production, NAMES.staging]) await migratePostgres(databaseUrl(name));
    production = openPostgres(databaseUrl(NAMES.production), { max: 1 });
    staging = openPostgres(databaseUrl(NAMES.staging), { max: 1 });
    open.push(production, staging);
    await runSeed(production.db, { seedDevAdmin: false });
    await markDatabaseEnvironment(
      production.db,
      'production',
      databaseIdentity(databaseUrl(NAMES.production)),
    );
    await createUserWithPassword(production.db, {
      email: 'client@example.com',
      name: 'Client',
      role: Role.Admin,
      password: 'Maple-Signal-Harbor-73',
      mustChangePassword: false,
    });
    await markDatabaseEnvironment(
      staging.db,
      'staging',
      databaseIdentity(databaseUrl(NAMES.staging)),
    );
  }, 120_000);

  afterAll(async () => {
    for (const connection of open) await connection.close();
    for (const name of Object.values(NAMES))
      await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end({ timeout: 5 });
  });

  it('refuses the wrong direction (empty staging → production) and leaves production as it was', () => {
    const result = runClone(databaseUrl(NAMES.staging), databaseUrl(NAMES.production));
    expect(result.status).toBe(1);
    expect(result.output).toMatch(/Nothing was changed/);
    return expect(emails(production)).resolves.toEqual(['client@example.com']);
  }, 120_000);

  it('refuses an unmigrated source before touching the target', async () => {
    const result = runClone(databaseUrl(NAMES.unmigrated), databaseUrl(NAMES.staging));
    expect(result.status).toBe(1);
    expect(result.output).toMatch(/not migrated/);
    expect((await readDatabaseMarker(staging.db))?.environment).toBe('staging');
  }, 120_000);

  it('refuses a target marked production even from a valid source', async () => {
    const copy = openPostgres(databaseUrl(NAMES.fresh), { max: 1 });
    open.push(copy);
    await migratePostgres(databaseUrl(NAMES.fresh));
    await copyTables(production.db, copy.db);
    await markDatabaseEnvironment(
      copy.db,
      'production',
      databaseIdentity(databaseUrl(NAMES.fresh)),
    );
    const result = runClone(databaseUrl(NAMES.fresh), databaseUrl(NAMES.production));
    expect(result.status).toBe(1);
    expect(result.output).toMatch(/live site's database/);
    expect(await emails(production)).toEqual(['client@example.com']);
  }, 120_000);

  it('a failure mid-copy rolls back on Postgres', async () => {
    await expect(
      cloneDatabase(production.db, staging.db, {
        targetIdentity: databaseIdentity(databaseUrl(NAMES.staging)),
        copy: async (from, to) => {
          await copyTables(from, to);
          throw new Error('connection lost');
        },
      }),
    ).rejects.toThrow('connection lost');
    expect(await emails(staging)).toEqual([]);
    expect((await readDatabaseMarker(staging.db))?.environment).toBe('staging');
  });

  it('happy path: production → staging copies everything and keeps the markers', async () => {
    const result = runClone(databaseUrl(NAMES.production), databaseUrl(NAMES.staging));
    expect(result.output).toMatch(/will be replaced|nothing to replace/);
    expect(result.status).toBe(0);
    expect(await emails(staging)).toEqual(['client@example.com']);
    expect((await readDatabaseMarker(staging.db))?.environment).toBe('staging');
    expect((await readDatabaseMarker(production.db))?.environment).toBe('production');
  }, 120_000);
});
