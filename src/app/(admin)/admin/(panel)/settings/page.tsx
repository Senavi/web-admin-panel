import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PageHeader } from '@/admin/components/layout/page-header';
import { SettingsScreen } from '@/admin/components/settings/settings-screen';
import { Skeleton } from '@/admin/ui/skeleton';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import type { MediaPreview } from '@/core/content/editor-types';
import { contentRegistry } from '@/core/content/project-registry';
import { getDb } from '@/core/db/client';
import { env, isProduction, MailProvider } from '@/core/env';
import { localeInfo } from '@/core/i18n/locales';
import { loadMedia } from '@/core/media/resolve';
import { readLocalizedSettings, readSiteSettings } from '@/core/settings/repository';
import { projectConfig } from '@project/config';

export const metadata: Metadata = { title: 'Settings' };
export const instant = false;

/** Plain description of how form emails are sent (Settings → Requests, developer mode). */
function emailProviderLine(): string {
  const { MAIL_PROVIDER, MAIL_FROM } = env();
  const provider = MAIL_PROVIDER ?? (isProduction() ? null : MailProvider.Dev);
  switch (provider) {
    case MailProvider.Resend:
      return `Resend · ${MAIL_FROM ?? 'MAIL_FROM not set'}`;
    case MailProvider.Smtp:
      return `SMTP (${env().SMTP_HOST ?? 'SMTP_HOST not set'}) · ${MAIL_FROM ?? 'MAIL_FROM not set'}`;
    case MailProvider.Dev:
      return 'Development: emails are saved as files in the local data folder (mail/).';
    case null:
      return 'Not configured: set MAIL_PROVIDER (resend or smtp). Requests are still saved.';
  }
}

export default async function SettingsPage() {
  await requirePermission(Permission.SettingsManage);
  const db = await getDb();
  const settings = await readSiteSettings(db);
  const enabled = settings.general.enabledLocales;
  const localized = Object.fromEntries(
    await Promise.all(
      enabled.map(async (code) => [code, await readLocalizedSettings(db, code)] as const),
    ),
  );

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
        description="Site name, look, Google and who can see the site."
      />
      {/* useSearchParams (?tab=) needs a Suspense boundary. */}
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <SettingsScreen
          settings={settings}
          localized={localized}
          locales={projectConfig.localeCodes.map((code) => ({
            code,
            label: localeInfo(code).label,
          }))}
          media={media}
          forms={contentRegistry.forms.map((form) => ({ id: form.id, label: form.label }))}
          telegramAvailable={Boolean(env().TELEGRAM_BOT_TOKEN)}
          emailProvider={emailProviderLine()}
        />
      </Suspense>
    </>
  );
}
