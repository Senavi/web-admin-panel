import { z } from 'zod';

import { projectConfig } from '@project/config';

/**
 * Site settings, stored as validated JSON (`settings` + `settings_localized`).
 * Every field has a default so new fields can be added without migrations;
 * `parse` fills in anything missing from older rows.
 */

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const localeCode = z.enum(projectConfig.localeCodes as [string, ...string[]]);
const mediaId = z.uuid().nullable().default(null);
const trimmed = (max: number) => z.string().trim().max(max);

export const generalSettingsSchema = z
  .object({
    siteName: trimmed(80).min(1).default(projectConfig.name),
    enabledLocales: z
      .array(localeCode)
      .min(1)
      .default([...projectConfig.localeCodes]),
    defaultLocale: localeCode.default(projectConfig.defaultLocale),
  })
  .refine((value) => value.enabledLocales.includes(value.defaultLocale), {
    message: 'The default locale must be enabled.',
    path: ['defaultLocale'],
  });

export const seoSettingsSchema = z.object({
  defaultOgImageId: mediaId,
  twitterHandle: z
    .string()
    .trim()
    .regex(/^(@?\w{1,15})?$/, 'Invalid X/Twitter handle')
    .default(''),
  organization: z
    .object({
      name: trimmed(120).default(''),
      url: z.union([z.url(), z.literal('')]).default(''),
      logoId: mediaId,
      sameAs: z.array(z.url()).max(10).default([]),
    })
    .prefault({}),
  verification: z
    .object({
      google: trimmed(200).default(''),
      bing: trimmed(200).default(''),
    })
    .prefault({}),
});

export const brandingSettingsSchema = z.object({
  logoLightId: mediaId,
  logoDarkId: mediaId,
  faviconId: mediaId,
  themeColor: z.string().regex(HEX_COLOR).default(projectConfig.brand.themeColor),
});

export const siteStatusSettingsSchema = z.object({
  maintenance: z
    .object({
      enabled: z.boolean().default(false),
      message: trimmed(500).default(''),
    })
    .prefault({}),
  indexing: z.boolean().default(true),
  privateMode: z.boolean().default(false),
});

export const analyticsSettingsSchema = z.object({
  excludeStaff: z.boolean().default(true),
  retentionMonths: z.number().int().min(1).max(60).default(13),
});

export const securitySettingsSchema = z.object({
  requireTwoFactorForAdmins: z.boolean().default(false),
  sessionLifetimeDays: z.number().int().min(1).max(90).default(7),
});

/** https only; plain http is accepted for localhost (local tools and tests). */
export const webhookUrlSchema = z
  .url('Use a full URL starting with https://')
  .max(2000)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
    );
  }, 'Use an https:// URL.');

export const formDestinationsSchema = z
  .object({
    email: z
      .object({
        enabled: z.boolean().default(false),
        recipients: z.array(z.email('Enter a valid email address.')).max(10).default([]),
      })
      .prefault({}),
    webhook: z
      .object({
        enabled: z.boolean().default(false),
        url: z.union([z.literal(''), webhookUrlSchema]).default(''),
      })
      .prefault({}),
    telegram: z
      .object({
        enabled: z.boolean().default(false),
        /** Numeric chat id (`-100…` for groups) or `@channel`. */
        chatId: trimmed(64)
          .regex(/^(-?[0-9]+|@[A-Za-z0-9_]{5,})?$/, 'Use a numeric chat id or @channel.')
          .default(''),
      })
      .prefault({}),
  })
  .superRefine((value, ctx) => {
    if (value.email.enabled && value.email.recipients.length === 0)
      ctx.addIssue({ code: 'custom', path: ['email', 'recipients'], message: 'Add a recipient.' });
    if (value.webhook.enabled && !value.webhook.url)
      ctx.addIssue({ code: 'custom', path: ['webhook', 'url'], message: 'Enter the webhook URL.' });
    if (value.telegram.enabled && !value.telegram.chatId)
      ctx.addIssue({ code: 'custom', path: ['telegram', 'chatId'], message: 'Enter the chat id.' });
  });
export type FormDestinations = z.output<typeof formDestinationsSchema>;

export const formsSettingsSchema = z.object({
  /** Submissions older than this are deleted by the maintenance job. */
  retentionMonths: z.number().int().min(1).max(60).default(12),
  /** Per form id. Forms without an entry are stored in the inbox only. */
  destinations: z.record(z.string().max(64), formDestinationsSchema).default({}),
});

export const siteSettingsSchema = z.object({
  general: generalSettingsSchema.prefault({}),
  seo: seoSettingsSchema.prefault({}),
  branding: brandingSettingsSchema.prefault({}),
  status: siteStatusSettingsSchema.prefault({}),
  analytics: analyticsSettingsSchema.prefault({}),
  security: securitySettingsSchema.prefault({}),
  forms: formsSettingsSchema.prefault({}),
});

export type SiteSettings = z.output<typeof siteSettingsSchema>;
export type SettingsGroup = keyof SiteSettings;

export const localizedSettingsSchema = z.object({
  /** `%s` is replaced with the page title. */
  titleTemplate: trimmed(120)
    .refine((value) => value === '' || value.includes('%s'), 'Must contain %s')
    .default('%s'),
  description: trimmed(300).default(''),
  ogTitle: trimmed(120).default(''),
  ogDescription: trimmed(300).default(''),
});

export type LocalizedSettings = z.output<typeof localizedSettingsSchema>;

export function defaultSiteSettings(): SiteSettings {
  return siteSettingsSchema.parse({});
}

export function defaultLocalizedSettings(): LocalizedSettings {
  return localizedSettingsSchema.parse({});
}
