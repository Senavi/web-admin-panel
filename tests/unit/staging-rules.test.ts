import { describe, expect, it } from 'vitest';

import { DeploymentEnvironment } from '@/core/deployment/environment';
import {
  destinationsForEnvironment,
  maintenanceMayDelete,
  settingsForEnvironment,
} from '@/core/deployment/rules';
import { formDestinationsSchema, siteSettingsSchema } from '@/core/settings/schema';

const { Production, Staging, Preview } = DeploymentEnvironment;

const live = siteSettingsSchema.parse({
  status: { indexing: true },
  integrations: {
    analytics: {
      ga4: { enabled: true, id: 'G-ABC123' },
      meta: { enabled: true, id: '123456789012345' },
    },
  },
});

describe('staging safety', () => {
  it('never indexes and never loads tracking on staging, whatever the copied settings say', () => {
    const staging = settingsForEnvironment(live, Staging);
    expect(staging.status.indexing).toBe(false);
    expect(Object.values(staging.integrations.analytics).every((tool) => !tool.enabled)).toBe(true);
    // The IDs stay (the admin shows the stored settings); only loading is off.
    expect(staging.integrations.analytics.ga4.id).toBe('G-ABC123');
  });

  it('changes nothing in production or previews', () => {
    expect(settingsForEnvironment(live, Production)).toBe(live);
    expect(settingsForEnvironment(live, Preview)).toBe(live);
  });

  it('routes form email to the team only and turns webhooks and Telegram off', () => {
    const client = formDestinationsSchema.parse({
      email: { enabled: true, recipients: ['owner@client.example'] },
      webhook: { enabled: true, url: 'https://hooks.client.example/forms' },
      telegram: { enabled: true, chatId: '-100123' },
    });
    const staging = destinationsForEnvironment(client, Staging, ['team@agency.example']);
    expect(staging?.email).toEqual({ enabled: true, recipients: ['team@agency.example'] });
    expect(staging?.webhook.enabled).toBe(false);
    expect(staging?.telegram.enabled).toBe(false);
    // Without STAGING_MAIL_TO nothing is emailed from staging.
    expect(destinationsForEnvironment(client, Staging, [])?.email.enabled).toBe(false);
    expect(destinationsForEnvironment(client, Production, ['team@agency.example'])).toBe(client);
  });

  it('maintenance deletes nothing on staging', () => {
    expect(maintenanceMayDelete(Staging)).toBe(false);
    expect(maintenanceMayDelete(Production)).toBe(true);
  });
});
