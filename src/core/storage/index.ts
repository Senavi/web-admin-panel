import 'server-only';

import { env, resolveStorageDriver, StorageDriver } from '@/core/env';

import { createLocalStorage } from './local';
import { createSupabaseStorage } from './supabase';
import type { StorageAdapter } from './types';

let adapter: StorageAdapter | undefined;

/** The configured storage adapter (see STORAGE_DRIVER in .env.example). */
export function getStorage(): StorageAdapter {
  if (adapter) return adapter;
  const config = env();
  if (resolveStorageDriver(config) === StorageDriver.Supabase) {
    adapter = createSupabaseStorage({
      url: config.SUPABASE_URL ?? '',
      serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY ?? '',
      bucket: config.SUPABASE_STORAGE_BUCKET,
    });
  } else {
    adapter = createLocalStorage();
  }
  return adapter;
}

export type { StorageAdapter } from './types';
