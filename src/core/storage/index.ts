import 'server-only';

import { env, resolveStorageDriver, StorageDriver } from '@/core/env';

import { createLocalStorage } from './local';
import { withReadFallback } from './read-fallback';
import { createS3Storage } from './s3';
import { createSupabaseStorage } from './supabase';
import type { StorageAdapter } from './types';

let adapter: StorageAdapter | undefined;

function primaryStorage(): StorageAdapter {
  const config = env();
  switch (resolveStorageDriver(config)) {
    case StorageDriver.S3:
      return createS3Storage({
        endpoint: config.S3_ENDPOINT ?? '',
        region: config.S3_REGION,
        bucket: config.S3_BUCKET ?? '',
        accessKeyId: config.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: config.S3_SECRET_ACCESS_KEY ?? '',
        publicUrl: config.S3_PUBLIC_URL,
        forcePathStyle: config.S3_FORCE_PATH_STYLE,
      });
    case StorageDriver.Supabase:
      return createSupabaseStorage({
        url: config.SUPABASE_URL ?? '',
        serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY ?? '',
        bucket: config.SUPABASE_STORAGE_BUCKET,
      });
    case StorageDriver.Local:
      return createLocalStorage();
  }
}

/** The configured storage adapter (STORAGE_DRIVER, S3_*, Supabase; see .env.example). */
export function getStorage(): StorageAdapter {
  if (adapter) return adapter;
  const fallback = env().STORAGE_READ_FALLBACK_URL;
  const primary = primaryStorage();
  adapter = fallback ? withReadFallback(primary, fallback) : primary;
  return adapter;
}

export type { StorageAdapter } from './types';
