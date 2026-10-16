import 'server-only';

import { eq } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';

import { projectConfig } from '@project/config';

import { registry } from '@/content';
import { getCollectionGateState } from '@/core/collections/loader';
import { contentRegistry } from '@/core/content/project-registry';

import { UserStatus } from '@/core/auth/roles';
import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';
import { users } from '@/core/db/schema';
import { selectedLocales } from '@/core/i18n/language-state';
import { isPreviewMode } from '@/core/preview/mode';
import { previewSiteState } from '@/core/preview/seed-data';
import { readSiteSettings } from '@/core/settings/repository';

import type { SiteState } from './state';

/** Builds the proxy's site state from settings and active users (cached, tag-invalidated). */
export async function loadSiteState(): Promise<SiteState> {
  'use cache';
  cacheLife('max');
  // Collection list tags: publishing, unpublishing, deleting or renaming an item updates the gate.
  cacheTag(
    CacheTag.Settings,
    CacheTag.Staff,
    ...contentRegistry.collections.map((collection) => CacheTag.collectionList(collection.id)),
  );
  if (isPreviewMode()) return previewSiteState();
  const db = await getDb();
  const [settings, staff] = await Promise.all([
    readSiteSettings(db),
    db
      .select({ id: users.id, version: users.sessionVersion })
      .from(users)
      .where(eq(users.status, UserStatus.Active)),
  ]);
  return {
    defaultLocale: settings.general.defaultLocale,
    enabledLocales: settings.general.enabledLocales,
    draftLocales: settings.general.draftLocales,
    supportedLocales: selectedLocales(settings.general),
    maintenance: settings.status.maintenance.enabled,
    privateMode: settings.status.privateMode,
    indexing: settings.status.indexing,
    staff: Object.fromEntries(staff.map((user) => [user.id, user.version])),
    routes: [
      ...registry.pages.map((page) => page.path),
      ...contentRegistry.collections.map((collection) => collection.itemPath),
      ...projectConfig.siteRoutes,
    ],
    collections: await getCollectionGateState(
      selectedLocales(settings.general),
      settings.general.defaultLocale,
    ),
  };
}
