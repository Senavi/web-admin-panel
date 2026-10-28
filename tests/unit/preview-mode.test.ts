import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { projectConfig } from '@project/config';

import { registry } from '@/content';
import type { AnyCollection } from '@/core/content/collection';
import {
  loadSeedMedia,
  publishedSeeds,
  previewSiteSettings,
  previewSiteState,
  seedAssetFile,
  seedMediaId,
} from '@/core/preview/seed-data';

/** A bundled seed image, if the project has one (the demo does; `demo:remove` deletes them). */
const SEED_IMAGE = fs
  .readdirSync(path.resolve('src/content/seed/assets'))
  .find((file) => /\.(webp|png|jpe?g)$/.test(file));

describe('preview mode data', () => {
  it('settings: every language on, never indexable, not paused or private', () => {
    const settings = previewSiteSettings();
    expect(settings.general.enabledLocales).toEqual([...projectConfig.localeCodes]);
    expect(settings.status).toMatchObject({ indexing: false, privateMode: false });
    expect(settings.status.maintenance.enabled).toBe(false);
  });

  it('site state: page routes, seed items, no staff', () => {
    const state = previewSiteState();
    expect(state.indexing).toBe(false);
    expect(state.staff).toEqual({});
    expect(state.routes).toEqual(expect.arrayContaining(registry.pages.map((page) => page.path)));
    // Every published seed item of every collection is routable.
    const collections: readonly AnyCollection[] = registry.collections;
    for (const collection of collections) {
      const items = state.collections.find((entry) => entry.itemPath === collection.itemPath);
      for (const item of publishedSeeds(collection))
        expect(Object.keys(items?.items ?? {})).toContain(item.slug);
    }
  });

  it.skipIf(!SEED_IMAGE)(
    'seed media ids are stable UUIDs and resolve to the bundled files',
    async () => {
      const file = SEED_IMAGE!;
      const id = seedMediaId(file);
      expect(z.uuid().safeParse(id).success).toBe(true);
      expect(seedMediaId(file)).toBe(id);
      const media = await loadSeedMedia([id, seedMediaId('missing.webp')]);
      expect(media.get(id)).toMatchObject({ src: `/api/seed-assets/${file}` });
      expect(media.get(id)?.width).toBeGreaterThan(0);
      expect(media.size).toBe(1);
    },
  );

  it('serves only plain file names from the seed folder', () => {
    expect(seedAssetFile('hero.webp')).toMatch(/seed[\\/]assets[\\/]hero\.webp$/);
    expect(seedAssetFile('../secret.txt')).toBeNull();
    expect(seedAssetFile('.env')).toBeNull();
  });
});
