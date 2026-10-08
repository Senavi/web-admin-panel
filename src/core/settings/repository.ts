import 'server-only';

import { eq } from 'drizzle-orm';

import { settings, settingsLocalized } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

import {
  localizedSettingsSchema,
  siteSettingsSchema,
  type LocalizedSettings,
  type SiteSettings,
} from './schema';

/** Uncached read of global settings (falls back to defaults if the row is missing). */
export async function readSiteSettings(db: Database): Promise<SiteSettings> {
  const [row] = await db.select({ data: settings.data }).from(settings).where(eq(settings.id, 1));
  return siteSettingsSchema.parse(row?.data ?? {});
}

export async function readLocalizedSettings(
  db: Database,
  locale: string,
): Promise<LocalizedSettings> {
  const [row] = await db
    .select({ data: settingsLocalized.data })
    .from(settingsLocalized)
    .where(eq(settingsLocalized.locale, locale));
  return localizedSettingsSchema.parse(row?.data ?? {});
}
