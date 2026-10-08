import { projectConfig } from '@project/config';

import { settings, settingsLocalized } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

import { defaultLocalizedSettings, defaultSiteSettings } from './schema';

/** Inserts default settings rows that don't exist yet. Never overwrites saved settings. */
export async function seedSettings(db: Database): Promise<void> {
  await db.insert(settings).values({ id: 1, data: defaultSiteSettings() }).onConflictDoNothing();
  await db
    .insert(settingsLocalized)
    .values(
      projectConfig.localeCodes.map((locale) => ({ locale, data: defaultLocalizedSettings() })),
    )
    .onConflictDoNothing();
}
