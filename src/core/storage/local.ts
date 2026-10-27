import fs from 'node:fs/promises';
import path from 'node:path';

import { UPLOADS_DIR } from '@/core/db/paths';

import { assertSafeKey, mediaRouteUrl, type StorageAdapter } from './types';

const META_SUFFIX = '.meta.json';

/** Files in `.data/uploads`, served by `/api/media/[...key]`. Development / self-hosting only. */
export function createLocalStorage(): StorageAdapter {
  const fileFor = (key: string) => {
    assertSafeKey(key);
    return path.join(UPLOADS_DIR, key);
  };
  return {
    driver: 'local',
    location: '.data/uploads',
    servedByRoute: true,
    async put(key, body, contentType) {
      const file = fileFor(key);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, body);
      await fs.writeFile(`${file}${META_SUFFIX}`, JSON.stringify({ contentType }));
    },
    async get(key) {
      const file = fileFor(key);
      try {
        const [body, meta] = await Promise.all([
          fs.readFile(file),
          fs.readFile(`${file}${META_SUFFIX}`, 'utf8'),
        ]);
        const { contentType } = JSON.parse(meta) as { contentType: string };
        return { body: new Uint8Array(body), contentType };
      } catch {
        return null;
      }
    },
    async delete(key) {
      const file = fileFor(key);
      await fs.rm(file, { force: true });
      await fs.rm(`${file}${META_SUFFIX}`, { force: true });
    },
    async list(prefix = '') {
      try {
        const files = await fs.readdir(UPLOADS_DIR, { recursive: true, withFileTypes: true });
        return files
          .filter((entry) => entry.isFile() && !entry.name.endsWith(META_SUFFIX))
          .map((entry) => path.relative(UPLOADS_DIR, path.join(entry.parentPath, entry.name)))
          .map((key) => key.split(path.sep).join('/'))
          .filter((key) => key.startsWith(prefix));
      } catch {
        return [];
      }
    },
    publicUrl: (key) => mediaRouteUrl(key),
    async check() {
      try {
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        await fs.access(UPLOADS_DIR, fs.constants.W_OK);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Not writable' };
      }
    },
  };
}
