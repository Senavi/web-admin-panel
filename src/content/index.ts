/**
 * PROJECT: page registry. Every page of the public site is listed here; the
 * admin's page tree, sitemap and content checks are built from it.
 * See docs/CONTENT_SCHEMA.md.
 */
import { createRegistry } from '@/core/content/registry';

import { aboutPage } from './pages/about';
import { contactPage } from './pages/contact';
import { homePage } from './pages/home';
import { teamPage } from './pages/team';

export const registry = createRegistry([homePage, aboutPage, teamPage, contactPage]);
