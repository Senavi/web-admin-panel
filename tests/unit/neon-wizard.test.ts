import { describe, expect, it } from 'vitest';

import {
  EMPTY_NEON_VALUES,
  NeonEnvironment,
  neonVariables,
} from '@/admin/components/security/neon-guides';
import {
  describeUsage,
  FREE_PLAN_LIMITS,
  formatBytes,
  usageLine,
  usageProblems,
} from '@/core/database/usage';
import { DatabaseProvider } from '@/core/db/connection-info';
import { parseEnv, resolveStorageDriver, StorageDriver } from '@/core/env-schema';

const values = {
  ...EMPTY_NEON_VALUES,
  databaseUrl: 'postgresql://u:p@ep-x-1-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  storageEndpoint: 'https://br-x-1.storage.c-1.eu-central-1.aws.neon.tech',
  storageRegion: 'eu-central-1',
  accessKeyId: 'nak_live_x',
  secretAccessKey: 'nsk_live_x',
};

describe('Connect Neon: variables per environment', () => {
  it('production gets the database, its own AUTH_SECRET and the storage', () => {
    const production = Object.fromEntries(
      neonVariables(NeonEnvironment.Production, values, 'secret-prod', 'team@agency.example'),
    );
    expect(Object.keys(production)).toEqual([
      'DATABASE_URL',
      'AUTH_SECRET',
      'S3_ENDPOINT',
      'S3_REGION',
      'S3_BUCKET',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
    ]);
    expect(production.AUTH_SECRET).toBe('secret-prod');
  });

  it('staging also migrates its own database and emails only the team', () => {
    const staging = Object.fromEntries(
      neonVariables(NeonEnvironment.Staging, values, 'secret-staging', 'team@agency.example'),
    );
    expect(staging.PREVIEW_DATABASE_ISOLATED).toBe('true');
    expect(staging.STAGING_MAIL_TO).toBe('team@agency.example');
    expect(staging.AUTH_SECRET).toBe('secret-staging');
  });

  it('the copied block is a complete, valid production environment', () => {
    const block = Object.fromEntries(
      neonVariables(NeonEnvironment.Production, values, 'x'.repeat(43), ''),
    );
    const env = parseEnv({
      ...block,
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: 'https://example.com',
    });
    expect(resolveStorageDriver(env)).toBe(StorageDriver.S3);
  });
});

describe('usage vs plan limits', () => {
  const neon = FREE_PLAN_LIMITS[DatabaseProvider.Neon]!;
  it('describes usage and warns from 80 %', () => {
    const low = usageLine(120 * 1024 * 1024, neon.databaseBytes);
    expect(describeUsage(low)).toBe('120 MB of 1.0 GB (12%)');
    expect(low.warn).toBe(false);
    const high = usageLine(0.85 * neon.storageBytes, neon.storageBytes);
    expect(high.warn).toBe(true);
    expect(usageProblems({ database: low, storage: high }, neon.plan)).toEqual([
      expect.stringMatching(/^Images use 4\.3 GB of 5\.0 GB \(85%\) of the Neon free plan/),
    ]);
  });

  it('shows plain sizes without a known limit', () => {
    expect(describeUsage(usageLine(2048, null))).toBe('2 KB');
    expect(formatBytes(12 * 1024 * 1024 * 1024)).toBe('12 GB');
    expect(FREE_PLAN_LIMITS[DatabaseProvider.Postgres]).toBeNull();
  });
});
