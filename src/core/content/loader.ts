import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { registry } from '@/content';
import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';
import { loadMedia, seedAssetIds, toResolvedImage } from '@/core/media/resolve';
import { getSiteSettings } from '@/core/settings/loader';

import type { ContentSchema, ResolvedPageContent } from './define';
import type { ImageValue } from './fields';
import { globalKey, type ResolvedGlobalContent } from './global';
import { contentRegistry } from './project-registry';
import { readPageRows, storedRowsFor } from './repository';
import {
  collectMediaIds,
  type ContentRecord,
  resolveImages,
  resolveWithFallback,
  seedAssets,
  seedToStored,
} from './values';

type RegisteredPage = (typeof registry.pages)[number];
export type PageId = RegisteredPage['id'];
type PageById<Id extends PageId> = Extract<RegisteredPage, { id: Id }>;

/** Fully typed content of a registered page, as the public site receives it. */
export type SitePageContent<Id extends PageId> = ResolvedPageContent<PageById<Id>['sections']>;

/**
 * Content of a page in a locale, typed from its schema. Missing localized
 * values fall back to the default locale, then to seed content, then to field
 * defaults. Cached and tagged `content:{pageId}` + `content:{pageId}:{locale}`.
 */
export async function getPageContent<Id extends PageId>(
  pageId: Id,
  locale: string,
): Promise<SitePageContent<Id>> {
  // The record is built from the page's own schema, so it matches the inferred type.
  return (await loadResolvedContent(pageId, locale)) as unknown as SitePageContent<Id>;
}

async function loadResolvedContent(pageId: string, locale: string): Promise<ContentRecord> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.content(pageId), CacheTag.contentLocale(pageId, locale), CacheTag.Settings);

  const page = registry.byId(pageId);
  if (!page) throw new Error(`Unknown page "${pageId}".`);
  return loadDocumentContent(page, pageId, locale);
}

type RegisteredGlobal = (typeof registry.globals)[number];
export type GlobalId = RegisteredGlobal['id'];
type GlobalById<Id extends GlobalId> = Extract<RegisteredGlobal, { id: Id }>;

/** Fully typed content of a registered global, as the public site receives it. */
export type SiteGlobalContent<Id extends GlobalId> = ResolvedGlobalContent<
  GlobalById<Id>['sections']
>;

/**
 * Content of a global (header/footer texts, contacts…) in a locale, typed from
 * its definition, with the same fallback chain as pages. Cached and tagged
 * `global:{id}`: saving it updates every page that rendered it.
 */
export async function getGlobalContent<Id extends GlobalId>(
  globalId: Id,
  locale: string,
): Promise<SiteGlobalContent<Id>> {
  return (await loadGlobalContent(globalId, locale)) as unknown as SiteGlobalContent<Id>;
}

async function loadGlobalContent(globalId: string, locale: string): Promise<ContentRecord> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.global(globalId), CacheTag.Settings);
  const global = contentRegistry.globalById(globalId);
  if (!global) throw new Error(`Unknown global "${globalId}".`);
  return loadDocumentContent(global, globalKey(global.id), locale);
}

/**
 * Stored rows → fallback chain (locale, default locale, seeds, defaults) →
 * resolved images, for any page-table document. Not cached itself: callers
 * wrap it in a `'use cache'` function with their own tags.
 */
export async function loadDocumentContent(
  schema: ContentSchema,
  key: string,
  locale: string,
): Promise<ContentRecord> {
  const db = await getDb();
  const { defaultLocale } = (await getSiteSettings()).general;

  const [rows, assetIds] = await Promise.all([
    readPageRows(db, key, [locale, defaultLocale]),
    seedAssetIds(db, seedAssets(schema)),
  ]);
  const seed = schema.seed as Partial<Record<string, ContentRecord>> | undefined;
  const content = resolveWithFallback(schema, {
    primary: storedRowsFor(rows, locale),
    defaultLocale: locale === defaultLocale ? undefined : storedRowsFor(rows, defaultLocale),
    seeds: [
      seedToStored(schema, seed?.[locale], assetIds),
      seedToStored(schema, seed?.[defaultLocale], assetIds),
    ],
  });

  const mediaById = await loadMedia(db, collectMediaIds(schema, content));
  return resolveImages(schema, content, (image: ImageValue) => toResolvedImage(image, mediaById));
}
