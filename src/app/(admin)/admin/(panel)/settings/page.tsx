import type { Metadata } from 'next';

import { PageHeader } from '@/admin/components/layout/page-header';
import { SettingsPanels } from '@/admin/components/settings/settings-panels';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import type { MediaPreview } from '@/core/content/editor-types';
import { getDb } from '@/core/db/client';
import { localeInfo } from '@/core/i18n/locales';
import { loadMedia } from '@/core/media/resolve';
import { readLocalizedSettings, readSiteSettings } from '@/core/settings/repository';
import { projectConfig } from '@project/config';

export const metadata: Metadata = { title: 'Settings' };
export const instant = false;

export default async function SettingsPage() {
  await requirePermission(Permission.SettingsManage);
  const db = await getDb();
  const settings = await readSiteSettings(db);
  const locale = settings.general.defaultLocale;
  const localized = await readLocalizedSettings(db, locale);

  const ids = [
    settings.seo.defaultOgImageId,
    settings.seo.organization.logoId,
    settings.branding.logoLightId,
    settings.branding.logoDarkId,
    settings.branding.faviconId,
  ].filter((id): id is string => Boolean(id));
  const media: Record<string, MediaPreview> = {};
  for (const [id, info] of await loadMedia(db, ids))
    media[id] = { id, src: info.src, width: info.width, height: info.height };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Site-wide configuration. Each card is saved separately."
      />
      <SettingsPanels
        settings={settings}
        localized={{ locale, values: localized }}
        locales={projectConfig.localeCodes.map((code) => ({ code, label: localeInfo(code).label }))}
        initialMedia={media}
      />
    </>
  );
}
