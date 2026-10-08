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

export const siteSettingsSchema = z.object({
  general: generalSettingsSchema.prefault({}),
  seo: seoSettingsSchema.prefault({}),
  branding: brandingSettingsSchema.prefault({}),
  status: siteStatusSettingsSchema.prefault({}),
  analytics: analyticsSettingsSchema.prefault({}),
  security: securitySettingsSchema.prefault({}),
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
