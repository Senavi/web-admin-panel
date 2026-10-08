import type { MetadataRoute } from 'next';

import { projectConfig } from '@project/config';

import { getSiteSettings } from '@/core/settings/loader';

/** Web app manifest from Settings (name, theme color) and the generated icons. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { general, branding } = await getSiteSettings();
  return {
    name: general.siteName,
    short_name: general.siteName.slice(0, 12),
    start_url: '/',
    display: 'standalone',
    theme_color: branding.themeColor,
    background_color: projectConfig.brand.backgroundColor,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
