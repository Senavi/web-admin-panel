import { createClient } from '@supabase/supabase-js';

import { assertSafeKey, type StorageAdapter } from './types';

export interface SupabaseStorageConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly bucket: string;
}

/**
 * Supabase Storage with a public-read bucket. Writes use the service role key
 * (server only); reads go straight to the public object URL.
 */
export function createSupabaseStorage(config: SupabaseStorageConfig): StorageAdapter {
  const client = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = () => client.storage.from(config.bucket);
  const publicBase = `${config.url.replace(/\/$/, '')}/storage/v1/object/public/${config.bucket}`;

  return {
    driver: 'supabase',
    location: `bucket "${config.bucket}"`,
    async put(key, body, contentType) {
      assertSafeKey(key);
      const { error } = await bucket().upload(key, body, {
        contentType,
        upsert: true,
        cacheControl: '31536000',
      });
      if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    },
    async get(key) {
      assertSafeKey(key);
      const { data, error } = await bucket().download(key);
      if (error || !data) return null;
      return { body: new Uint8Array(await data.arrayBuffer()), contentType: data.type };
    },
    async delete(key) {
      assertSafeKey(key);
      const { error } = await bucket().remove([key]);
      if (error) throw new Error(`Supabase delete failed: ${error.message}`);
    },
    publicUrl: (key) => `${publicBase}/${key}`,
    async check() {
      const { error } = await client.storage.getBucket(config.bucket);
      return error ? { ok: false, error: error.message } : { ok: true };
    },
  };
}
