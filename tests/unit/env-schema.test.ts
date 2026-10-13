import { describe, expect, it } from 'vitest';

import { AUTH_SECRET_HKDF_INFO, deriveAuthSecret } from '@/core/auth/secret';
import { migrationDecision } from '@/core/db/deploy-context';
import { parseEnv, resolveStorageDriver, StorageDriver } from '@/core/env-schema';
import { isPreviewMode } from '@/core/preview/mode';
import { resolveSiteUrl } from '@/core/site-url';

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

  it('accepts production without any variable: preview mode', () => {
    const env = parseEnv({ NODE_ENV: 'production' });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(isPreviewMode({ NODE_ENV: 'production' })).toBe(true);
    // Local storage is not refused either: preview mode stores nothing.
    expect(() => parseEnv({ NODE_ENV: 'production', STORAGE_DRIVER: 'local' })).not.toThrow();
  });

  it('is never preview mode in development, tests or with a database', () => {
    expect(isPreviewMode({ NODE_ENV: 'development' })).toBe(false);
    expect(isPreviewMode({ NODE_ENV: 'test' })).toBe(false);
    expect(isPreviewMode({ NODE_ENV: 'production', DATABASE_URL: PROD_BASE.DATABASE_URL })).toBe(
      false,
    );
  });

  it('needs only DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Netlify/Vercel', () => {
    const minimal = {
      NODE_ENV: 'production',
      DATABASE_URL: PROD_BASE.DATABASE_URL,
      SUPABASE_URL: PROD_BASE.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: PROD_BASE.SUPABASE_SERVICE_ROLE_KEY,
    };
    expect(() =>
      parseEnv({ ...minimal, NETLIFY: 'true', URL: 'https://site.netlify.app' }),
    ).not.toThrow();
    expect(() =>
      parseEnv({ ...minimal, VERCEL_PROJECT_PRODUCTION_URL: 'site.vercel.app' }),
    ).not.toThrow();
  });

  it('with a database, requires a secret source and a site address', () => {
    const withDb = { NODE_ENV: 'production', DATABASE_URL: PROD_BASE.DATABASE_URL };
    expect(() =>
      parseEnv({ ...withDb, STORAGE_DRIVER: 'local', ALLOW_LOCAL_STORAGE_IN_PRODUCTION: 'true' }),
    ).toThrowError(/AUTH_SECRET[\s\S]*NEXT_PUBLIC_SITE_URL/);
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
    const db = { DATABASE_URL: PROD_BASE.DATABASE_URL };
    expect(migrationDecision(db).migrate).toBe(true);
    expect(migrationDecision({ ...db, VERCEL_ENV: 'production' }).migrate).toBe(true);
    expect(migrationDecision({ ...db, VERCEL_ENV: 'preview' }).migrate).toBe(false);
    expect(migrationDecision({ ...db, NETLIFY: 'true', CONTEXT: 'production' }).migrate).toBe(true);
    expect(migrationDecision({ ...db, NETLIFY: 'true', CONTEXT: 'deploy-preview' }).migrate).toBe(
      false,
    );
    expect(
      migrationDecision({
        ...db,
        NETLIFY: 'true',
        CONTEXT: 'branch-deploy',
        PREVIEW_DATABASE_ISOLATED: 'true',
      }).migrate,
    ).toBe(true);
  });

  it('skips with a clear reason without DATABASE_URL (preview mode)', () => {
    const decision = migrationDecision({ VERCEL_ENV: 'production' });
    expect(decision.migrate).toBe(false);
    expect(decision.reason).toMatch(/no DATABASE_URL.*preview mode/);
  });
});

describe('site URL fallbacks', () => {
  it('prefers NEXT_PUBLIC_SITE_URL', () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: 'https://www.example.com/',
        URL: 'https://x.netlify.app',
      }),
    ).toBe('https://www.example.com');
  });

  it('uses Netlify URL in production and DEPLOY_PRIME_URL for previews', () => {
    const netlify = {
      NETLIFY: 'true',
      URL: 'https://site.netlify.app',
      DEPLOY_PRIME_URL: 'https://deploy-preview-4--site.netlify.app',
    };
    expect(resolveSiteUrl({ ...netlify, CONTEXT: 'production' })).toBe('https://site.netlify.app');
    expect(resolveSiteUrl({ ...netlify, CONTEXT: 'deploy-preview' })).toBe(
      'https://deploy-preview-4--site.netlify.app',
    );
  });

  it('adds https:// to Vercel hosts; previews use VERCEL_URL', () => {
    const vercel = {
      VERCEL_PROJECT_PRODUCTION_URL: 'site.vercel.app',
      VERCEL_URL: 'site-git-branch.vercel.app',
    };
    expect(resolveSiteUrl({ ...vercel, VERCEL_ENV: 'production' })).toBe('https://site.vercel.app');
    expect(resolveSiteUrl({ ...vercel, VERCEL_ENV: 'preview' })).toBe(
      'https://site-git-branch.vercel.app',
    );
  });

  it('is null when nothing is known', () => {
    expect(resolveSiteUrl({})).toBeNull();
  });
});

describe('derived AUTH_SECRET', () => {
  it('is stable, long enough and depends on the service role key', () => {
    const first = deriveAuthSecret('service-role-key-a');
    expect(first).toBe(deriveAuthSecret('service-role-key-a'));
    expect(first).not.toBe(deriveAuthSecret('service-role-key-b'));
    expect(Buffer.from(first, 'base64url').length).toBeGreaterThanOrEqual(32);
    expect(AUTH_SECRET_HKDF_INFO).toMatch(/auth-secret/);
  });
});
