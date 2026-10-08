import 'server-only';

import { eq } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';

import { projectConfig } from '@project/config';

import { registry } from '@/content';

import { UserStatus } from '@/core/auth/roles';
import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';
import { users } from '@/core/db/schema';
import { readSiteSettings } from '@/core/settings/repository';

import type { SiteState } from './state';

/** Builds the proxy's site state from settings and active users (cached, tag-invalidated). */
export async function loadSiteState(): Promise<SiteState> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.Settings, CacheTag.Staff);
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
    supportedLocales: [...projectConfig.localeCodes],
    maintenance: settings.status.maintenance.enabled,
    privateMode: settings.status.privateMode,
    indexing: settings.status.indexing,
    staff: Object.fromEntries(staff.map((user) => [user.id, user.version])),
    routes: [...registry.pages.map((page) => page.path), ...projectConfig.siteRoutes],
  };
}
