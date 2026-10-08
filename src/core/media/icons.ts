import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { CacheTag } from '@/core/cache/tags';
import { getSiteSettings } from '@/core/settings/loader';
import { getStorage } from '@/core/storage';

import {
  defaultIconSource,
  FAVICON_FILES,
  type FaviconFile,
  faviconKey,
  generateFavicons,
} from './favicon';

export interface IconFile {
  readonly base64: string;
  readonly contentType: string;
}

/**
 * Bytes of one favicon file: from the uploaded favicon set (Settings → Branding)
 * or generated from the site initial + theme color. Cached; invalidated on settings save.
 */
export async function loadIcon(file: FaviconFile): Promise<IconFile> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.Settings);
  const settings = await getSiteSettings();
  const contentType = file.endsWith('.ico') ? 'image/x-icon' : 'image/png';
  const faviconId = settings.branding.faviconId;
  if (faviconId) {
    const stored = await getStorage().get(faviconKey(faviconId, file));
    if (stored) return { base64: Buffer.from(stored.body).toString('base64'), contentType };
  }
  const source = await defaultIconSource(settings.general.siteName, settings.branding.themeColor);
  const files = await generateFavicons(source, settings.branding.themeColor);
  const data = files.get(file);
  if (!data) throw new Error(`Unknown icon ${file}`);
  return { base64: data.toString('base64'), contentType };
}

export const ICON_ROUTE_PREFIX = '/icons';
export const ICON_SIZES = FAVICON_FILES;
