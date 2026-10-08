import { describe, expect, it } from 'vitest';

import { migrationDecision } from '@/core/db/deploy-context';
import { parseEnv, resolveStorageDriver, StorageDriver } from '@/core/env-schema';

const PROD_BASE = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@db.example.com:6543/postgres',
  AUTH_SECRET: 'x'.repeat(32),
  NEXT_PUBLIC_SITE_URL: 'https://example.com',
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
} as const;

describe('env schema', () => {
  it('accepts an empty development environment (zero config)', () => {
    const env = parseEnv({ NODE_ENV: 'development' });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(resolveStorageDriver(env)).toBe(StorageDriver.Local);
  });

  it('treats empty strings as unset', () => {
    const env = parseEnv({ NODE_ENV: 'development', DATABASE_URL: '' });
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it('requires DATABASE_URL, AUTH_SECRET and site URL in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrowError(
      /DATABASE_URL[\s\S]*AUTH_SECRET[\s\S]*NEXT_PUBLIC_SITE_URL/,
    );
  });

  it('accepts a complete production environment', () => {
    const env = parseEnv(PROD_BASE);
    expect(resolveStorageDriver(env)).toBe(StorageDriver.Supabase);
  });

  it('rejects local storage in production unless explicitly allowed', () => {
    const base = { ...PROD_BASE, STORAGE_DRIVER: 'local' };
    expect(() => parseEnv(base)).toThrowError(/STORAGE_DRIVER/);
    expect(() => parseEnv({ ...base, ALLOW_LOCAL_STORAGE_IN_PRODUCTION: 'true' })).not.toThrow();
  });

  it('rejects short secrets', () => {
    expect(() => parseEnv({ NODE_ENV: 'development', AUTH_SECRET: 'short' })).toThrowError(
      /AUTH_SECRET/,
    );
  });
});

describe('deploy migrations', () => {
  it('migrate only in production deploys or isolated previews', () => {
    expect(migrationDecision({}).migrate).toBe(true);
    expect(migrationDecision({ VERCEL_ENV: 'production' }).migrate).toBe(true);
    expect(migrationDecision({ VERCEL_ENV: 'preview' }).migrate).toBe(false);
    expect(migrationDecision({ NETLIFY: 'true', CONTEXT: 'production' }).migrate).toBe(true);
    expect(migrationDecision({ NETLIFY: 'true', CONTEXT: 'deploy-preview' }).migrate).toBe(false);
    expect(
      migrationDecision({
        NETLIFY: 'true',
        CONTEXT: 'branch-deploy',
        PREVIEW_DATABASE_ISOLATED: 'true',
      }).migrate,
    ).toBe(true);
  });
});
