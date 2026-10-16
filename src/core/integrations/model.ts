/**
 * Settings → Integrations (pure, client-safe): analytics and marketing tools,
 * email presets, ID validation, the scripts a site loads after consent and the
 * origins they need in the Content-Security-Policy. docs/DECISIONS.md D-091.
 */
import type { SiteCspSources } from '../project/define';

export const AnalyticsId = {
  Ga4: 'ga4',
  Gtm: 'gtm',
  Hotjar: 'hotjar',
  HubSpot: 'hubspot',
  Meta: 'meta',
} as const;
export type AnalyticsId = (typeof AnalyticsId)[keyof typeof AnalyticsId];

export interface AnalyticsDefinition {
  readonly id: AnalyticsId;
  readonly name: string;
  readonly description: string;
  /** What the ID field is called in the tool's own dashboard. */
  readonly idLabel: string;
  readonly placeholder: string;
  readonly pattern: RegExp;
  readonly invalidMessage: string;
  /** Short note for tools that may slow the site down. */
  readonly performanceNote?: string;
  /** Origins the tool needs (added to the site CSP while it is on). */
  readonly csp: SiteCspSources;
}

const GOOGLE_TAG = 'https://www.googletagmanager.com';

export const ANALYTICS: readonly AnalyticsDefinition[] = [
  {
    id: AnalyticsId.Ga4,
    name: 'Google Analytics 4',
    description: 'Counts visitors and shows where they come from in Google Analytics.',
    idLabel: 'Measurement ID',
    placeholder: 'G-XXXXXXXXXX',
    pattern: /^G-[A-Z0-9]{6,12}$/,
    invalidMessage: 'Use the Measurement ID that starts with G- (for example G-ABC123XYZ4).',
    csp: {
      scriptSrc: [GOOGLE_TAG],
      connectSrc: [
        'https://*.google-analytics.com',
        'https://*.analytics.google.com',
        'https://*.googletagmanager.com',
      ],
      imgSrc: ['https://*.google-analytics.com', GOOGLE_TAG],
    },
  },
  {
    id: AnalyticsId.Gtm,
    name: 'Google Tag Manager',
    description: 'Manages your marketing tags from one place.',
    idLabel: 'Container ID',
    placeholder: 'GTM-XXXXXXX',
    pattern: /^GTM-[A-Z0-9]{4,10}$/,
    invalidMessage: 'Use the Container ID that starts with GTM- (for example GTM-AB12CD3).',
    performanceNote: 'Tags inside the container can slow the site down a little.',
    csp: {
      scriptSrc: [GOOGLE_TAG],
      connectSrc: [
        'https://*.google-analytics.com',
        'https://*.analytics.google.com',
        'https://*.googletagmanager.com',
      ],
      imgSrc: ['https://*.google-analytics.com', GOOGLE_TAG],
      frameSrc: [GOOGLE_TAG],
    },
  },
  {
    id: AnalyticsId.Hotjar,
    name: 'Hotjar',
    description: 'Heatmaps and recordings of how visitors use the site.',
    idLabel: 'Site ID',
    placeholder: '1234567',
    pattern: /^[0-9]{5,9}$/,
    invalidMessage: 'Use the numeric Site ID from Hotjar.',
    performanceNote: 'Recordings may slow the site down a little.',
    csp: {
      scriptSrc: ['https://static.hotjar.com', 'https://script.hotjar.com'],
      connectSrc: ['https://*.hotjar.com', 'https://*.hotjar.io', 'wss://*.hotjar.com'],
      imgSrc: ['https://*.hotjar.com'],
      fontSrc: ['https://script.hotjar.com'],
      frameSrc: ['https://vars.hotjar.com'],
    },
  },
  {
    id: AnalyticsId.HubSpot,
    name: 'HubSpot',
    description: 'Tracking code that connects visits to your HubSpot contacts.',
    idLabel: 'Portal ID',
    placeholder: '12345678',
    pattern: /^[0-9]{5,10}$/,
    invalidMessage: 'Use the numeric Portal ID (Hub ID) from HubSpot.',
    performanceNote: 'The tracking code is heavy and may slow the site down a little.',
    csp: {
      scriptSrc: [
        'https://js.hs-scripts.com',
        'https://js.hs-analytics.net',
        'https://js.hsadspixel.net',
        'https://js.hs-banner.com',
        'https://js.usemessages.com',
      ],
      connectSrc: ['https://*.hubspot.com', 'https://*.hs-analytics.net', 'https://*.hsforms.com'],
      imgSrc: ['https://*.hubspot.com', 'https://*.hsforms.com'],
      frameSrc: ['https://*.hubspot.com'],
    },
  },
  {
    id: AnalyticsId.Meta,
    name: 'Meta Pixel',
    description: 'Measures ads and builds audiences on Facebook and Instagram.',
    idLabel: 'Pixel ID',
    placeholder: '123456789012345',
    pattern: /^[0-9]{10,20}$/,
    invalidMessage: 'Use the numeric Pixel ID from Meta Events Manager.',
    performanceNote: 'May slow the site down a little.',
    csp: {
      scriptSrc: ['https://connect.facebook.net'],
      connectSrc: ['https://www.facebook.com', 'https://connect.facebook.net'],
      imgSrc: ['https://www.facebook.com'],
    },
  },
];

export function analyticsDefinition(id: AnalyticsId): AnalyticsDefinition {
  const definition = ANALYTICS.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`Unknown analytics integration "${id}".`);
  return definition;
}

/** Stored settings of one analytics integration. */
export interface AnalyticsSetting {
  readonly enabled: boolean;
  readonly id: string;
}
export type AnalyticsSettings = Readonly<Record<AnalyticsId, AnalyticsSetting>>;

/** Integrations that are on with a valid ID, in a stable order. */
export function activeAnalytics(
  settings: AnalyticsSettings,
): Array<AnalyticsDefinition & { value: string }> {
  return ANALYTICS.flatMap((definition) => {
    const setting = settings[definition.id];
    return setting?.enabled && definition.pattern.test(setting.id)
      ? [{ ...definition, value: setting.id }]
      : [];
  });
}

/** A script the site loads after the visitor accepts cookies. */
export interface ConsentScript {
  readonly id: string;
  /** next/script strategy: tag managers run early, heavier tools when the page is idle. */
  readonly strategy: 'afterInteractive' | 'lazyOnload';
  /** External file; `inline` is run as it is (IDs are validated, so embedding them is safe). */
  readonly src?: string;
  readonly inline?: string;
}

function scriptsFor(id: AnalyticsId, value: string): ConsentScript[] {
  switch (id) {
    case AnalyticsId.Ga4:
      return [
        {
          id: 'ga4-src',
          strategy: 'afterInteractive',
          src: `https://www.googletagmanager.com/gtag/js?id=${value}`,
        },
        {
          id: 'ga4-init',
          strategy: 'afterInteractive',
          inline: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${value}');`,
        },
      ];
    case AnalyticsId.Gtm:
      return [
        {
          id: 'gtm',
          strategy: 'afterInteractive',
          inline: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${value}');`,
        },
      ];
    case AnalyticsId.Hotjar:
      return [
        {
          id: 'hotjar',
          strategy: 'lazyOnload',
          inline: `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${value},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
        },
      ];
    case AnalyticsId.HubSpot:
      return [
        { id: 'hubspot', strategy: 'lazyOnload', src: `https://js.hs-scripts.com/${value}.js` },
      ];
    case AnalyticsId.Meta:
      return [
        {
          id: 'meta-pixel',
          strategy: 'lazyOnload',
          inline: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${value}');fbq('track','PageView');`,
        },
      ];
  }
}

/** All scripts of the integrations that are on (loaded only after Accept). */
export function consentScripts(settings: AnalyticsSettings): ConsentScript[] {
  return activeAnalytics(settings).flatMap((item) => scriptsFor(item.id, item.value));
}

const CSP_KEYS: ReadonlyArray<keyof SiteCspSources> = [
  'scriptSrc',
  'styleSrc',
  'imgSrc',
  'fontSrc',
  'connectSrc',
  'frameSrc',
  'mediaSrc',
  'formAction',
];

/** Joins CSP source lists (no duplicates). */
export function mergeCspSources(...lists: ReadonlyArray<SiteCspSources>): SiteCspSources {
  const merged: Record<string, string[]> = {};
  for (const list of lists) {
    for (const key of CSP_KEYS) {
      const sources = list[key];
      if (sources?.length) merged[key] = [...new Set([...(merged[key] ?? []), ...sources])];
    }
  }
  return merged;
}

/** Origins the site CSP needs for the integrations that are on. */
export function integrationCspSources(settings: AnalyticsSettings): SiteCspSources {
  return mergeCspSources(...activeAnalytics(settings).map((item) => item.csp));
}

// ── Email ────────────────────────────────────────────────────────────────────

export const EmailProviderKind = { None: 'none', Resend: 'resend', Smtp: 'smtp' } as const;
export type EmailProviderKind = (typeof EmailProviderKind)[keyof typeof EmailProviderKind];

export const SmtpSecurity = { StartTls: 'starttls', Ssl: 'ssl', None: 'none' } as const;
export type SmtpSecurity = (typeof SmtpSecurity)[keyof typeof SmtpSecurity];

export interface SmtpPreset {
  readonly id: string;
  readonly label: string;
  readonly host: string;
  readonly port: number;
  readonly security: SmtpSecurity;
  /** Hint for the user field ("apikey" for SendGrid). */
  readonly userHint?: string;
}

export const SMTP_PRESETS: readonly SmtpPreset[] = [
  {
    id: 'brevo',
    label: 'Brevo',
    host: 'smtp-relay.brevo.com',
    port: 587,
    security: SmtpSecurity.StartTls,
  },
  {
    id: 'mailgun',
    label: 'Mailgun',
    host: 'smtp.mailgun.org',
    port: 587,
    security: SmtpSecurity.StartTls,
  },
  {
    id: 'postmark',
    label: 'Postmark',
    host: 'smtp.postmarkapp.com',
    port: 587,
    security: SmtpSecurity.StartTls,
  },
  {
    id: 'sendgrid',
    label: 'SendGrid',
    host: 'smtp.sendgrid.net',
    port: 587,
    security: SmtpSecurity.StartTls,
    userHint: 'apikey',
  },
  {
    id: 'gmail',
    label: 'Gmail / Google Workspace',
    host: 'smtp.gmail.com',
    port: 587,
    security: SmtpSecurity.StartTls,
  },
  { id: 'other', label: 'Other', host: '', port: 587, security: SmtpSecurity.StartTls },
];
export const SMTP_PRESET_IDS = SMTP_PRESETS.map((preset) => preset.id) as [string, ...string[]];

/** `Name <forms@example.com>` or `forms@example.com`, without line breaks. */
export const MAIL_FROM_PATTERN =
  /^(?:[^<>\r\n]{1,100}\s<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/;

export interface EmailCheck {
  readonly ok: boolean;
  readonly at: string;
  readonly error?: string;
}

// ── Status ───────────────────────────────────────────────────────────────────

export const IntegrationStatus = { Off: 'off', On: 'on', Error: 'error' } as const;
export type IntegrationStatus = (typeof IntegrationStatus)[keyof typeof IntegrationStatus];
