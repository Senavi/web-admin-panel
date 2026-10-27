import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';
import { currentEnvironment } from '@/core/deployment/current';
import { settingsForEnvironment } from '@/core/deployment/rules';
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
  // Staging never indexes or loads tracking, whatever the copied settings say (D-097).
  return settingsForEnvironment(await readSiteSettings(await getDb()), currentEnvironment());
}

export async function getLocalizedSettings(locale: string): Promise<LocalizedSettings> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.Settings);
  if (isPreviewMode()) return previewLocalizedSettings();
  return readLocalizedSettings(await getDb(), locale);
}
