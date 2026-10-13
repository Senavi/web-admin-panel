import 'server-only';

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { projectConfig } from '@project/config';

import { registry } from '@/content';
import {
  type AnyCollection,
  collectionBasePath,
  CollectionItemStatus,
  MissingTranslation,
} from '@/core/content/collection';
import { contentRegistry } from '@/core/content/project-registry';
import { SEED_ASSETS_DIR } from '@/core/db/paths';
import type { MediaInfo } from '@/core/media/resolve';
import {
  defaultLocalizedSettings,
  defaultSiteSettings,
  type LocalizedSettings,
  type SiteSettings,
} from '@/core/settings/schema';
import type { SiteState } from '@/core/site-gate/state';

/**
 * Data for preview mode (production without a database): default settings,
 * seed images served from the build and the site state, all derived from the
 * project's code. Every value is deterministic, so prerendering is stable.
 */

/** Route that serves `src/content/seed/assets/*` in preview mode (next/image optimizes it). */
export const SEED_ASSET_PATH = '/api/seed-assets';
const PLACEHOLDER_WIDTH = 16;

/** Defaults with every supported language on and the site hidden from search engines. */
export function previewSiteSettings(): SiteSettings {
  const defaults = defaultSiteSettings();
  return {
    ...defaults,
    general: { ...defaults.general, enabledLocales: [...projectConfig.localeCodes] },
    status: {
      maintenance: { ...defaults.status.maintenance, enabled: false },
      indexing: false,
      privateMode: false,
    },
  };
}

export function previewLocalizedSettings(): LocalizedSettings {
  return defaultLocalizedSettings();
}

/**
 * Media id of a seed image in preview mode: a UUID (version 8, RFC 9562)
 * derived from the file name, so it passes the same validation as uploads and
 * is identical on every instance and build.
 */
export function seedMediaId(asset: string): string {
  const hex = createHash('sha256')
    .update(`site-starter/seed-asset/${path.basename(asset)}`)
    .digest('hex');
  const variant = ((Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

let assetNames: Promise<Map<string, string>> | undefined;

/** Seed media id → file name, for every file in the seed assets folder. */
function seedAssetNames(): Promise<Map<string, string>> {
  assetNames ??= fs
    .readdir(/*turbopackIgnore: true*/ SEED_ASSETS_DIR)
    .catch(() => [] as string[])
    .then(
      (names) =>
        new Map(
          names.filter((name) => seedAssetFile(name)).map((name) => [seedMediaId(name), name]),
        ),
    );
  return assetNames;
}

/** Seed asset name → preview media id (the counterpart of `seedAssetIds` with a database). */
export function previewAssetIds(assets: readonly string[]): Map<string, string> {
  return new Map(assets.map((asset) => [asset, seedMediaId(asset)]));
}

/** Absolute path of a seed asset, or null for anything outside the assets folder. */
export function seedAssetFile(name: string): string | null {
  const base = path.basename(name);
  if (!base || base !== name || base.startsWith('.')) return null;
  return path.join(/*turbopackIgnore: true*/ SEED_ASSETS_DIR, base);
}

const infoCache = new Map<string, Promise<MediaInfo | null>>();

async function readSeedMedia(id: string, name: string): Promise<MediaInfo | null> {
  const file = seedAssetFile(name);
  if (!file) return null;
  const bytes = await fs.readFile(/*turbopackIgnore: true*/ file).catch(() => null);
  if (!bytes) return null;
  const image = sharp(bytes);
  const { width = 0, height = 0 } = await image.metadata();
  const placeholder = await sharp(bytes)
    .resize({ width: PLACEHOLDER_WIDTH })
    .webp({ quality: 40 })
    .toBuffer();
  return {
    id,
    src: `${SEED_ASSET_PATH}/${encodeURIComponent(name)}`,
    width,
    height,
    blurDataURL: `data:image/webp;base64,${placeholder.toString('base64')}`,
  };
}

/** Seed images by preview media id (dimensions and blur placeholder read once per process). */
export async function loadSeedMedia(ids: readonly string[]): Promise<Map<string, MediaInfo>> {
  const names = await seedAssetNames();
  const entries = await Promise.all(
    [...new Set(ids)].flatMap((id) => {
      const name = names.get(id);
      if (!name) return [];
      let info = infoCache.get(id);
      if (!info) {
        info = readSeedMedia(id, name);
        infoCache.set(id, info);
      }
      return [info.then((value) => [id, value] as const)];
    }),
  );
  return new Map(entries.flatMap(([id, info]) => (info ? [[id, info] as const] : [])));
}

/** Seed items that are published (seed items are published unless `status` says otherwise). */
export function publishedSeeds(collection: AnyCollection): NonNullable<AnyCollection['seed']> {
  return (collection.seed ?? []).filter(
    (seed) => (seed.status ?? CollectionItemStatus.Published) === CollectionItemStatus.Published,
  );
}

/** Locales where a seed item is shown (hidden translations are left out). */
export function seedItemLocales(
  missingTranslation: MissingTranslation,
  translated: readonly string[],
  enabledLocales: readonly string[],
  defaultLocale: string,
): string[] {
  return enabledLocales.filter(
    (locale) =>
      missingTranslation === MissingTranslation.Fallback ||
      locale === defaultLocale ||
      translated.includes(locale),
  );
}

/** The proxy's site state in preview mode: defaults, no staff, seed items only. */
export function previewSiteState(): SiteState {
  const settings = previewSiteSettings();
  const { enabledLocales, defaultLocale } = settings.general;
  return {
    defaultLocale,
    enabledLocales,
    supportedLocales: [...projectConfig.localeCodes],
    maintenance: false,
    privateMode: false,
    indexing: false,
    staff: {},
    routes: [
      ...registry.pages.map((page) => page.path),
      ...contentRegistry.collections.map((collection) => collection.itemPath),
      ...projectConfig.siteRoutes,
    ],
    collections: contentRegistry.collections.map((collection) => ({
      itemPath: collection.itemPath,
      listPath: collectionBasePath(collection),
      pageSize: collection.pageSize,
      items: Object.fromEntries(
        publishedSeeds(collection).map((seed) => [
          seed.slug,
          seedItemLocales(
            collection.missingTranslation,
            Object.keys(seed.content),
            enabledLocales,
            defaultLocale,
          ),
        ]),
      ),
      redirects: {},
    })),
  };
}
