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
  adminPath: '/admin',
  // Public routes outside the content registry (e.g. '/legal', '/blog/:slug'). Others → 404.
  siteRoutes: [],
  brand: {
    // Used for the browser UI theme color until one is set in Settings → Branding.
    themeColor: '#1d4ed8',
  },
});

export type ProjectLocale = (typeof projectConfig.localeCodes)[number];
