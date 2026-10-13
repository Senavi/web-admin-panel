import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';
import { isPreviewMode } from '@/core/preview/mode';
import { previewLocalizedSettings, previewSiteSettings } from '@/core/preview/seed-data';

import { readLocalizedSettings, readSiteSettings } from './repository';
import type { LocalizedSettings, SiteSettings } from './schema';

/** Cached settings for rendering (invalidated by the `settings` tag on save). */
export async function getSiteSettings(): Promise<SiteSettings> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.Settings);
  if (isPreviewMode()) return previewSiteSettings();
  return readSiteSettings(await getDb());
}

export async function getLocalizedSettings(locale: string): Promise<LocalizedSettings> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.Settings);
  if (isPreviewMode()) return previewLocalizedSettings();
  return readLocalizedSettings(await getDb(), locale);
}
