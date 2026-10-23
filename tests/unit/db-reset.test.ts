import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { isLocalDatabaseUrl, resetRefusal } from '@/core/db/reset-guard';

const REMOTE =
  'postgresql://postgres.abc:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';

describe('db:reset guard', () => {
  it('allows the local PGlite database in development', () => {
    expect(resetRefusal({ NODE_ENV: 'development' })).toBeNull();
    expect(resetRefusal({})).toBeNull();
  });

  it('refuses production and any configured database, remote ones with a clear message', () => {
    expect(resetRefusal({ NODE_ENV: 'production' })).toMatch(/production/);
    expect(resetRefusal({ DATABASE_URL: REMOTE })).toMatch(/remote database/);
    expect(resetRefusal({ DIRECT_URL: REMOTE })).toMatch(/remote database/);
    expect(resetRefusal({ DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/db' })).toMatch(
      /DATABASE_URL is set/,
    );
    expect(resetRefusal({ DATABASE_URL: REMOTE })).not.toContain('secret');
  });

  it('tells local from remote hosts', () => {
    expect(isLocalDatabaseUrl('postgres://u:p@localhost:5432/db')).toBe(true);
    expect(isLocalDatabaseUrl('postgres://u:p@[::1]:5432/db')).toBe(true);
    expect(isLocalDatabaseUrl(REMOTE)).toBe(false);
    expect(isLocalDatabaseUrl('not a url')).toBe(false);
  });
});

describe('pnpm db:reset (script)', () => {
  it('refuses a remote DATABASE_URL and deletes nothing', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-reset-'));
    const marker = path.join(dataDir, 'pglite', 'keep.txt');
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, 'local data');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: REMOTE,
      SITE_DATA_DIR: dataDir,
      NODE_ENV: 'development',
    };
    delete env.NODE_OPTIONS;
    const result = spawnSync(
      process.execPath,
      [
        path.resolve('node_modules/tsx/dist/cli.mjs'),
        '--conditions=react-server',
        'scripts/db-reset.ts',
        '--yes',
      ],
      { env, encoding: 'utf8', timeout: 60_000 },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/remote database/);
    expect(result.stderr).not.toContain('secret');
    expect(fs.existsSync(marker)).toBe(true);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }, 60_000);
});
