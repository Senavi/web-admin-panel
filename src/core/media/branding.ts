import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';
import { getSiteSettings } from '@/core/settings/loader';

import { loadMedia, type MediaInfo } from './resolve';

export interface SiteLogo extends MediaInfo {
  readonly isSvg: boolean;
}

/** Logo uploaded in Settings → Branding (light-background variant), or null. */
export async function getSiteLogo(variant: 'light' | 'dark' = 'light'): Promise<SiteLogo | null> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.Settings);
  const { branding } = await getSiteSettings();
  const id = variant === 'light' ? branding.logoLightId : branding.logoDarkId;
  if (!id) return null;
  const info = (await loadMedia(await getDb(), [id])).get(id);
  return info ? { ...info, isSvg: info.src.endsWith('.svg') } : null;
}

/** Favicon metadata with a cache-busting version per uploaded favicon. */
export async function getIconMetadata() {
  const { branding } = await getSiteSettings();
  const v = branding.faviconId ? `?v=${branding.faviconId.slice(0, 8)}` : '';
  return {
    icon: [
      { url: `/favicon.ico${v}`, sizes: 'any' },
      { url: `/icons/icon-32.png${v}`, sizes: '32x32', type: 'image/png' },
      { url: `/icons/icon-192.png${v}`, sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: `/icons/apple-touch-icon.png${v}`, sizes: '180x180' }],
  };
}
