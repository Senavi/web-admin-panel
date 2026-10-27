import { isStaging } from '@/core/deployment/current';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PageHeader } from '@/admin/components/layout/page-header';
import { SettingsScreen } from '@/admin/components/settings/settings-screen';
import { Skeleton } from '@/admin/ui/skeleton';
import { can, Permission } from '@/core/auth/permissions';
import { hasRecipients } from '@/core/integrations/health';
import { readSecretInfos } from '@/core/integrations/secrets';
import { MailSource } from '@/core/mail/config';
import { requirePermission } from '@/core/auth/server/session';
import type { MediaPreview } from '@/core/content/editor-types';
import { contentRegistry } from '@/core/content/project-registry';
import { getDb } from '@/core/db/client';
import { env } from '@/core/env';
import { mailStatus } from '@/core/forms/mail-status';
import { localeInfo } from '@/core/i18n/locales';
import { loadMedia } from '@/core/media/resolve';
import { readLocalizedSettings } from '@/core/settings/repository';
import { getRequestSettings } from '@/core/settings/request';
import { selectedLocales } from '@/core/i18n/language-state';

export const metadata: Metadata = { title: 'Settings' };
export const instant = false;

export default async function SettingsPage() {
  const user = await requirePermission(Permission.SettingsManage);
  const db = await getDb();
  const settings = await getRequestSettings();
  const enabled = selectedLocales(settings.general);
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

  const mail = await mailStatus(db);
  const integrations = can(user.role, Permission.IntegrationsManage)
    ? {
        secrets: await readSecretInfos(db),
        emailFromServer: mail.source === MailSource.Env ? mail.line : null,
      }
    : null;
  const noRecipientsWarning =
    contentRegistry.forms.length > 0 &&
    mail.configured &&
    mail.source !== MailSource.Dev &&
    !hasRecipients(settings.forms);

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
          locales={enabled.map((code) => ({
            code,
            label: localeInfo(code).label,
            draft: settings.general.draftLocales.includes(code),
          }))}
          media={media}
          forms={contentRegistry.forms.map((form) => ({ id: form.id, label: form.label }))}
          telegramAvailable={Boolean(env().TELEGRAM_BOT_TOKEN)}
          emailProvider={mail.line}
          integrations={integrations}
          noRecipientsWarning={noRecipientsWarning}
          stagingMailTo={isStaging() ? (env().STAGING_MAIL_TO ?? []) : null}
          staging={isStaging()}
        />
      </Suspense>
    </>
  );
}
