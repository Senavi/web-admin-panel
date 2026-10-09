/**
 * PROJECT: content registry. Every page of the public site, every collection,
 * global and form is listed here; the admin, sitemap and content checks are built
 * from it. See docs/CONTENT_SCHEMA.md.
 */
import { createRegistry } from '@/core/content/registry';

import { blog } from './collections/blog';
import { contactForm } from './forms/contact';
import { siteGlobals } from './globals/site';
import { aboutPage } from './pages/about';
import { blogPage } from './pages/blog';
import { contactPage } from './pages/contact';
import { homePage } from './pages/home';
import { teamPage } from './pages/team';

export const registry = createRegistry({
  pages: [homePage, aboutPage, teamPage, blogPage, contactPage],
  collections: [blog],
  globals: [siteGlobals],
  forms: [contactForm],
});
