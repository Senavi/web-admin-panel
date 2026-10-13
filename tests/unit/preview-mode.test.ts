import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { projectConfig } from '@project/config';

import { registry } from '@/content';
import {
  loadSeedMedia,
  previewSiteSettings,
  previewSiteState,
  seedAssetFile,
  seedMediaId,
} from '@/core/preview/seed-data';

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
    const blog = state.collections.find((collection) => collection.itemPath === '/blog/:slug');
    expect(Object.keys(blog?.items ?? {})).toContain('hello-world');
  });

  it('seed media ids are stable UUIDs and resolve to the bundled files', async () => {
    const id = seedMediaId('hero.webp');
    expect(z.uuid().safeParse(id).success).toBe(true);
    expect(seedMediaId('hero.webp')).toBe(id);
    const media = await loadSeedMedia([id, seedMediaId('missing.webp')]);
    expect(media.get(id)).toMatchObject({ src: '/api/seed-assets/hero.webp' });
    expect(media.get(id)?.width).toBeGreaterThan(0);
    expect(media.size).toBe(1);
  });

  it('serves only plain file names from the seed folder', () => {
    expect(seedAssetFile('hero.webp')).toMatch(/seed\/assets\/hero\.webp$/);
    expect(seedAssetFile('../secret.txt')).toBeNull();
    expect(seedAssetFile('.env')).toBeNull();
  });
});
