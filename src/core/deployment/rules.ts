import type { FormDestinations, SiteSettings } from '@/core/settings/schema';

import { DeploymentEnvironment } from './environment';

/**
 * Staging safety (D-097). A staging database is often a copy of production, so
 * staging must never act like the live site, whatever its settings say:
 * - never indexed (no sitemap, robots disallow, `noindex`);
 * - tracking integrations (GA, GTM, Hotjar, HubSpot, Meta Pixel) never load;
 * - form emails go only to the team (`STAGING_MAIL_TO`), never to the client's
 *   recipients, Telegram or webhooks;
 * - maintenance deletes nothing (no retention cleanup).
 * Pure: unit-tested. The admin shows the stored settings unchanged.
 */

/** Settings as the site uses them in this environment. */
export function settingsForEnvironment(
  settings: SiteSettings,
  environment: DeploymentEnvironment,
): SiteSettings {
  if (environment !== DeploymentEnvironment.Staging) return settings;
  const analytics = Object.fromEntries(
    Object.entries(settings.integrations.analytics).map(([id, tool]) => [
      id,
      { ...tool, enabled: false },
    ]),
  ) as SiteSettings['integrations']['analytics'];
  return {
    ...settings,
    status: { ...settings.status, indexing: false },
    integrations: { ...settings.integrations, analytics },
  };
}

/**
 * Where a form's submission goes in this environment. Staging: email only, and only
 * to `stagingMailTo` (nothing when it is empty); webhooks and Telegram are off.
 */
export function destinationsForEnvironment(
  config: FormDestinations | undefined,
  environment: DeploymentEnvironment,
  stagingMailTo: readonly string[],
): FormDestinations | undefined {
  if (environment !== DeploymentEnvironment.Staging || !config) return config;
  return {
    ...config,
    email: { enabled: stagingMailTo.length > 0, recipients: [...stagingMailTo] },
    webhook: { ...config.webhook, enabled: false },
    telegram: { ...config.telegram, enabled: false },
  };
}

export const INDEXING_LABELS = {
  visible: 'Visible in Google',
  hidden: 'Hidden from Google',
  staging: 'Hidden from Google (staging)',
} as const;

/** How the admin summarizes indexing: staging is never indexed, whatever the stored setting. */
export function indexingLabel(indexing: boolean, environment: DeploymentEnvironment): string {
  if (environment === DeploymentEnvironment.Staging) return INDEXING_LABELS.staging;
  return indexing ? INDEXING_LABELS.visible : INDEXING_LABELS.hidden;
}

/** Maintenance may delete data (retention) only outside staging. */
export function maintenanceMayDelete(environment: DeploymentEnvironment): boolean {
  return environment !== DeploymentEnvironment.Staging;
}
