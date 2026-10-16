import { z } from 'zod';

import { projectConfig } from '@project/config';

import { isKnownLanguage } from '@/core/i18n/languages';
import {
  AnalyticsId,
  analyticsDefinition,
  EmailProviderKind,
  MAIL_FROM_PATTERN,
  SMTP_PRESET_IDS,
  SmtpSecurity,
} from '@/core/integrations/model';

/**
 * Site settings, stored as validated JSON (`settings` + `settings_localized`).
 * Every field has a default so new fields can be added without migrations;
 * `parse` fills in anything missing from older rows.
 */

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
/** Any language of the master list (`core/i18n/languages.ts`) or one the project config names. */
export const localeCode = z
  .string()
  .refine(
    (code) =>
      isKnownLanguage(code) || (projectConfig.localeCodes as readonly string[]).includes(code),
    'Unknown language.',
  );
const mediaId = z.uuid().nullable().default(null);
const trimmed = (max: number) => z.string().trim().max(max);

export const generalSettingsSchema = z
  .object({
    siteName: trimmed(80).min(1).default(projectConfig.name),
    /** Published languages: routed on the site, in the switcher, sitemap and hreflang. */
    enabledLocales: z
      .array(localeCode)
      .min(1)
      .default([...projectConfig.localeCodes]),
    /** Draft languages: editable in the admin, hidden on the site (staff can preview them). */
    draftLocales: z.array(localeCode).default([]),
    defaultLocale: localeCode.default(projectConfig.defaultLocale),
  })
  .refine((value) => value.enabledLocales.includes(value.defaultLocale), {
    message: 'The main language must be published.',
    path: ['defaultLocale'],
  })
  .refine((value) => !value.draftLocales.some((code) => value.enabledLocales.includes(code)), {
    message: 'A language is either a draft or published.',
    path: ['draftLocales'],
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

/** One analytics tool: off, or on with an ID in the tool's format. */
const analyticsToolSchema = (pattern: RegExp, message: string) =>
  z
    .object({
      enabled: z.boolean().default(false),
      id: trimmed(40).default(''),
    })
    .superRefine((value, ctx) => {
      if (value.enabled && !pattern.test(value.id))
        ctx.addIssue({ code: 'custom', path: ['id'], message });
      if (value.id !== '' && !pattern.test(value.id))
        ctx.addIssue({ code: 'custom', path: ['id'], message });
    });

function analyticsTool(id: AnalyticsId) {
  const { pattern, invalidMessage } = analyticsDefinition(id);
  return analyticsToolSchema(pattern, invalidMessage).prefault({});
}

export const emailIntegrationSchema = z
  .object({
    provider: z
      .enum([EmailProviderKind.None, EmailProviderKind.Resend, EmailProviderKind.Smtp])
      .default(EmailProviderKind.None),
    /** `Name <forms@example.com>`. */
    from: trimmed(200).default(''),
    smtp: z
      .object({
        preset: z.enum(SMTP_PRESET_IDS).default('other'),
        host: trimmed(255)
          .regex(/^[A-Za-z0-9.-]*$/, 'Use a host name like smtp.example.com.')
          .default(''),
        port: z.number().int().min(1).max(65535).default(587),
        user: trimmed(255).default(''),
        security: z
          .enum([SmtpSecurity.StartTls, SmtpSecurity.Ssl, SmtpSecurity.None])
          .default(SmtpSecurity.StartTls),
      })
      .prefault({}),
    /** Result of the last "Send test email". */
    lastCheck: z
      .object({
        ok: z.boolean(),
        at: z.string().max(40),
        error: z.string().max(300).optional(),
      })
      .nullable()
      .default(null),
  })
  .superRefine((value, ctx) => {
    if (value.provider === EmailProviderKind.None) return;
    if (!MAIL_FROM_PATTERN.test(value.from))
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'Enter the sender, for example Website <forms@example.com>.',
      });
    if (value.provider === EmailProviderKind.Smtp && !value.smtp.host)
      ctx.addIssue({ code: 'custom', path: ['smtp', 'host'], message: 'Enter the SMTP server.' });
  });

export const integrationsSettingsSchema = z.object({
  analytics: z
    .object({
      [AnalyticsId.Ga4]: analyticsTool(AnalyticsId.Ga4),
      [AnalyticsId.Gtm]: analyticsTool(AnalyticsId.Gtm),
      [AnalyticsId.Hotjar]: analyticsTool(AnalyticsId.Hotjar),
      [AnalyticsId.HubSpot]: analyticsTool(AnalyticsId.HubSpot),
      [AnalyticsId.Meta]: analyticsTool(AnalyticsId.Meta),
    })
    .prefault({}),
  email: emailIntegrationSchema.prefault({}),
});

export const formsSettingsSchema = z.object({
  /** Recipients of every form that has no list of its own. */
  defaultRecipients: z.array(z.email('Enter a valid email address.')).max(10).default([]),
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
  integrations: integrationsSettingsSchema.prefault({}),
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
