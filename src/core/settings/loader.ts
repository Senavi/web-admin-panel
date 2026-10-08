import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';

import { readLocalizedSettings, readSiteSettings } from './repository';
import type { LocalizedSettings, SiteSettings } from './schema';

/** Cached settings for rendering (invalidated by the `settings` tag on save). */
export async function getSiteSettings(): Promise<SiteSettings> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.Settings);
  return readSiteSettings(await getDb());
}

export async function getLocalizedSettings(locale: string): Promise<LocalizedSettings> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.Settings);
  return readLocalizedSettings(await getDb(), locale);
}
