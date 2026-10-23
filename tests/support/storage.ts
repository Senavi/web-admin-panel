import type { StorageAdapter } from '@/core/storage/types';

/** In-memory storage adapter for tests (files kept in a map). */
export function memoryStorage(): StorageAdapter & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    driver: 'local',
    location: 'memory',
    put: async (key, body) => void files.set(key, body),
    get: async (key) => {
      const body = files.get(key);
      return body ? { body: new Uint8Array(body), contentType: 'image/webp' } : null;
    },
    delete: async (key) => void files.delete(key),
    publicUrl: (key) => `/media/${key}`,
    check: async () => ({ ok: true }),
  };
}
