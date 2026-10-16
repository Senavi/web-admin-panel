/**
 * PROJECT CONFIG — edit this file for every new project.
 * See docs/CUSTOMIZING.md.
 */
import { defineProjectConfig } from '@/core/project/define';

export const projectConfig = defineProjectConfig({
  name: 'Site Starter Demo',
  supportedLocales: [
    { code: 'en', label: 'English' },
    { code: 'uk', label: 'Українська' },
  ],
  defaultLocale: 'en',
  // Writing systems the fonts in src/site/theme/fonts.ts cover (Latn, Latx = Latin extended, Cyrl…).
  // Languages outside this set get a "check with your developer" warning in Settings.
  fontScripts: ['Latn', 'Cyrl'],
  // Admin URL: a custom path per project (`/<4 consonants of the domain>-admin`).
  adminPath: '/stst-admin',
  // Public routes outside the content registry (e.g. '/legal', '/blog/:slug'). Others → 404.
  siteRoutes: [],
  // Extra Content-Security-Policy sources for the public site (third-party scripts, embeds…).
  // e.g. csp: { scriptSrc: ['https://www.googletagmanager.com'], frameSrc: ['https://www.youtube-nocookie.com'] },
  csp: {},
  brand: {
    // Used for the browser UI theme color until one is set in Settings → Branding.
    themeColor: '#1d4ed8',
  },
});

export type ProjectLocale = (typeof projectConfig.localeCodes)[number];
