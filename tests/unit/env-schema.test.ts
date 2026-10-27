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

  it('needs only DATABASE_URL and SUPABASE_SERVICE_ROLE_KEY with a Supabase connection string', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL:
        'postgresql://postgres.abcdefghijklmnopqrst:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      NETLIFY: 'true',
      URL: 'https://site.netlify.app',
    });
    expect(env.SUPABASE_URL).toBe('https://abcdefghijklmnopqrst.supabase.co');
    expect(resolveStorageDriver(env)).toBe(StorageDriver.Supabase);
  });

  it('an explicit SUPABASE_URL still wins over the derived one', () => {
    const env = parseEnv({
      ...PROD_BASE,
      DATABASE_URL: 'postgresql://postgres:pw@db.abcdefghijklmnopqrst.supabase.co:5432/postgres',
    });
    expect(env.SUPABASE_URL).toBe(PROD_BASE.SUPABASE_URL);
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

describe('env per database provider', () => {
  const NEON =
    'postgresql://u:p@ep-cool-1-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';
  const S3 = {
    S3_ENDPOINT: 'https://br-cool-1.storage.c-1.eu-central-1.aws.neon.tech',
    S3_REGION: 'eu-central-1',
    S3_BUCKET: 'media',
    S3_ACCESS_KEY_ID: 'nak_live_x',
    S3_SECRET_ACCESS_KEY: 'nsk_live_x',
  };
  const neonProduction = {
    NODE_ENV: 'production',
    NEXT_PUBLIC_SITE_URL: 'https://example.com',
    DATABASE_URL: NEON,
  };

  it('Neon needs AUTH_SECRET (nothing to derive it from) and says how to make one', () => {
    expect(() => parseEnv({ ...neonProduction, ...S3 })).toThrowError(
      /AUTH_SECRET.*no Supabase key.*openssl rand -base64 48/s,
    );
  });

  it('Neon without storage variables explains how to add Neon storage', () => {
    expect(() => parseEnv({ ...neonProduction, AUTH_SECRET: 'x'.repeat(32) })).toThrowError(
      /Neon has no file storage.*S3_ENDPOINT/s,
    );
  });

  it('Neon with AUTH_SECRET and S3 storage is complete', () => {
    const env = parseEnv({ ...neonProduction, ...S3, AUTH_SECRET: 'x'.repeat(32) });
    expect(resolveStorageDriver(env)).toBe(StorageDriver.S3);
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
  });

  it('S3 storage needs all four of its variables', () => {
    expect(() =>
      parseEnv({ ...neonProduction, AUTH_SECRET: 'x'.repeat(32), S3_BUCKET: 'media' }),
    ).toThrowError(/S3_ENDPOINT is required for S3 storage/);
  });

  it('Supabase deploys need nothing new', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SITE_URL: 'https://example.com',
        DATABASE_URL:
          'postgresql://postgres.abcdefghijklmnopqrst:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      }),
    ).not.toThrow();
  });

  it('parses the staging mail list and the environment override', () => {
    const env = parseEnv({
      NODE_ENV: 'development',
      STAGING_MAIL_TO: 'a@example.com, b@example.com',
      DEPLOYMENT_ENVIRONMENT: 'staging',
    });
    expect(env.STAGING_MAIL_TO).toEqual(['a@example.com', 'b@example.com']);
    expect(() => parseEnv({ NODE_ENV: 'development', STAGING_MAIL_TO: 'nope' })).toThrow();
    expect(() => parseEnv({ NODE_ENV: 'development', DEPLOYMENT_ENVIRONMENT: 'qa' })).toThrow();
  });
});
