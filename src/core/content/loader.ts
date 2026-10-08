import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { registry } from '@/content';
import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';
import { loadMedia, seedAssetIds, toResolvedImage } from '@/core/media/resolve';
import { getSiteSettings } from '@/core/settings/loader';

import type { ResolvedPageContent } from './define';
import type { ImageValue } from './fields';
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
  const db = await getDb();
  const { defaultLocale } = (await getSiteSettings()).general;

  const [rows, assetIds] = await Promise.all([
    readPageRows(db, pageId, [locale, defaultLocale]),
    seedAssetIds(db, seedAssets(page)),
  ]);
  const seed = page.seed as Partial<Record<string, ContentRecord>> | undefined;
  const content = resolveWithFallback(page, {
    primary: storedRowsFor(rows, locale),
    defaultLocale: locale === defaultLocale ? undefined : storedRowsFor(rows, defaultLocale),
    seeds: [
      seedToStored(page, seed?.[locale], assetIds),
      seedToStored(page, seed?.[defaultLocale], assetIds),
    ],
  });

  const mediaById = await loadMedia(db, collectMediaIds(page, content));
  return resolveImages(page, content, (image: ImageValue) => toResolvedImage(image, mediaById));
}
