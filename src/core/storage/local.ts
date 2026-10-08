import fs from 'node:fs/promises';
import path from 'node:path';

import { DATA_DIR } from '@/core/db/paths';

import { assertSafeKey, MEDIA_ROUTE_PREFIX, type StorageAdapter } from './types';

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
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
    publicUrl: (key) => `${MEDIA_ROUTE_PREFIX}/${key}`,
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
