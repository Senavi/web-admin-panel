import 'server-only';

import { z } from 'zod';

import { getDb } from '@/core/db/client';
import {
  DatabaseProvider,
  databaseIdentity,
  databaseProvider,
  migrationUrl,
} from '@/core/db/connection-info';
import { migratePostgres, openPostgres } from '@/core/db/drivers/postgres';
import { DeploymentEnvironment } from '@/core/deployment/environment';
import { createLocalStorage } from '@/core/storage/local';
import { createS3Storage } from '@/core/storage/s3';

import { copyMediaFiles } from './clone';
import { copyTables } from './copy';
import { markDatabaseEnvironment } from './environment-marker';
import { checkPostgres, type CheckResult } from './supabase-connect';

/**
 * Connect Neon (D-096): one Neon project with the branches `production` and
 * `staging`, each with a pooled connection string and Object Storage
 * credentials. Development only, admins only (see `database/actions.ts`).
 * Nothing is written to .env files: everyone keeps developing on the local
 * database; the values go to the hosting platform per environment.
 */
const postgresUrl = z
  .string()
  .trim()
  .regex(/^postgres(ql)?:\/\//, 'Use a postgres:// connection string.');

export const neonEnvironmentSchema = z.object({
  databaseUrl: postgresUrl.refine((url) => databaseProvider(url) === DatabaseProvider.Neon, {
    message: 'Paste the connection string from Neon → Connect (it contains neon.tech).',
  }),
  storageEndpoint: z.url('Paste the storage endpoint (https://…neon.tech).').trim(),
  storageRegion: z.string().trim().min(2, 'Enter the region, e.g. eu-central-1.'),
  bucket: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9.-]{1,62}$/, 'Lowercase letters, numbers, dots and dashes.'),
  accessKeyId: z.string().trim().min(8, 'Paste the access key ID (nak_…).'),
  secretAccessKey: z.string().trim().min(8, 'Paste the secret access key (nsk_…).'),
});
export type NeonEnvironment = z.output<typeof neonEnvironmentSchema>;

export const neonConnectionSchema = z.object({
  production: neonEnvironmentSchema,
  staging: neonEnvironmentSchema,
});
export type NeonConnection = z.output<typeof neonConnectionSchema>;

function storageOf(input: NeonEnvironment) {
  return createS3Storage({
    endpoint: input.storageEndpoint,
    region: input.storageRegion,
    bucket: input.bucket,
    accessKeyId: input.accessKeyId,
    secretAccessKey: input.secretAccessKey,
    forcePathStyle: true,
  });
}

/** Checks one environment: pooled and derived direct connection, storage. */
export async function testNeonEnvironment(
  label: string,
  input: NeonEnvironment,
): Promise<CheckResult[]> {
  const direct = migrationUrl({ DATABASE_URL: input.databaseUrl }) ?? input.databaseUrl;
  const [pooled, directCheck, storage] = await Promise.all([
    checkPostgres(`${label}: database (pooled)`, input.databaseUrl),
    direct === input.databaseUrl
      ? Promise.resolve(null)
      : checkPostgres(`${label}: database (direct, for migrations)`, direct),
    storageOf(input).check(),
  ]);
  return [
    pooled,
    ...(directCheck ? [directCheck] : []),
    storage.ok
      ? { name: `${label}: file storage`, ok: true, message: `bucket "${input.bucket}"` }
      : { name: `${label}: file storage`, ok: false, message: storage.error },
  ];
}

/**
 * Prepares the production branch now (deploys would do it too): migrations, the
 * production marker (D-098), and
 * optionally this computer's content, users and images (off by default: in a
 * team the online database fills itself from the code).
 */
export async function prepareNeonProduction(
  input: NeonEnvironment,
  copyLocal: boolean,
): Promise<{ rows: Record<string, number>; files: number }> {
  const direct = migrationUrl({ DATABASE_URL: input.databaseUrl }) ?? input.databaseUrl;
  await migratePostgres(direct);
  const remote = openPostgres(direct, { max: 1 });
  try {
    await markDatabaseEnvironment(
      remote.db,
      DeploymentEnvironment.Production,
      databaseIdentity(direct),
    );
    if (!copyLocal) return { rows: {}, files: 0 };
    const local = await getDb();
    const rows = await copyTables(local, remote.db);
    const files = await copyMediaFiles(local, createLocalStorage(), storageOf(input));
    return { rows, files };
  } finally {
    await remote.close();
  }
}
