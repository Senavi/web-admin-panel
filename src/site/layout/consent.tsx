import { getTranslations } from 'next-intl/server';
import { projectConfig } from '@project/config';

import { localizedPath } from '@/core/i18n/routing';
import { consentScripts } from '@/core/integrations/model';
import { getSiteSettings } from '@/core/settings/loader';

import { CookieBanner, CookieSettingsLink } from '../components/cookie-banner';

/** Scripts of the integrations that are on (none → no banner, nothing loads). */
async function activeScripts() {
  const { integrations } = await getSiteSettings();
  return consentScripts(integrations.analytics);
}

/** The cookie banner and consent-based scripts; renders nothing when no integration needs consent. */
export async function Consent({
  locale,
  defaultLocale,
}: {
  locale: string;
  defaultLocale: string;
}) {
  const scripts = await activeScripts();
  if (scripts.length === 0) return null;
  const t = await getTranslations('cookie');
  return (
    <CookieBanner
      scripts={scripts}
      privacyHref={
        projectConfig.privacyPath
          ? localizedPath(projectConfig.privacyPath, locale, defaultLocale)
          : undefined
      }
      texts={{
        label: t('label'),
        text: t('text'),
        privacy: t('privacy'),
        accept: t('accept'),
        decline: t('decline'),
      }}
    />
  );
}

/** "Cookie settings" in the footer; only when the banner exists. */
export async function CookieSettings() {
  if ((await activeScripts()).length === 0) return null;
  const t = await getTranslations('cookie');
  return <CookieSettingsLink label={t('settings')} />;
}
