import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/core/auth/secret', () => ({ getAuthSecret: () => 'unit-test-secret-0123456789abcdef' }));

import { decryptSecret, encryptSecret, secretHint } from '@/core/integrations/crypto';
import { hasRecipients } from '@/core/integrations/health';
import {
  ANALYTICS,
  AnalyticsId,
  analyticsDefinition,
  consentScripts,
  integrationCspSources,
  MAIL_FROM_PATTERN,
  mergeCspSources,
} from '@/core/integrations/model';
import { withDefaultRecipients } from '@/core/forms/delivery';
import { staticPageCsp } from '@/core/security/headers';
import {
  emailIntegrationSchema,
  formDestinationsSchema,
  integrationsSettingsSchema,
  siteSettingsSchema,
} from '@/core/settings/schema';

const KEY = 'auth-secret-0123456789abcdef-0123456789';

describe('encrypted secrets', () => {
  it('round-trips a value with a random IV each time', () => {
    const first = encryptSecret(KEY, 'smtp.password', 'p@ss w0rd ✓');
    const second = encryptSecret(KEY, 'smtp.password', 'p@ss w0rd ✓');
    expect(first).not.toBe(second);
    expect(first).not.toContain('p@ss');
    expect(decryptSecret(KEY, 'smtp.password', first)).toBe('p@ss w0rd ✓');
  });

  it('becomes unreadable (null, no crash) when the auth secret is rotated', () => {
    const token = encryptSecret(KEY, 'resend.apiKey', 're_secret');
    expect(decryptSecret(`${KEY}-rotated`, 'resend.apiKey', token)).toBeNull();
  });

  it('is bound to its name and rejects damaged or foreign tokens', () => {
    const token = encryptSecret(KEY, 'resend.apiKey', 're_secret');
    expect(decryptSecret(KEY, 'smtp.password', token)).toBeNull();
    const [version, iv, tag] = token.split('.');
    const tampered = [version, iv, tag, Buffer.from('tampered').toString('base64url')].join('.');
    expect(decryptSecret(KEY, 'resend.apiKey', tampered)).toBeNull();
    expect(decryptSecret(KEY, 'resend.apiKey', 'plain text')).toBeNull();
  });

  it('shows only a masked tail, and nothing for short values', () => {
    expect(secretHint('re_abcdefghijklmnop1234')).toBe('••••1234');
    expect(secretHint('short')).toBe('••••');
  });
});

describe('integration IDs', () => {
  const valid: Record<string, string> = {
    ga4: 'G-ABC123XYZ4',
    gtm: 'GTM-AB12CD3',
    hotjar: '1234567',
    hubspot: '12345678',
    meta: '123456789012345',
  };
  const invalid: Record<string, string> = {
    ga4: 'UA-12345-1',
    gtm: 'G-ABC123XYZ4',
    hotjar: 'abc',
    hubspot: '12',
    meta: '12345',
  };

  it('validates the format of every tool', () => {
    for (const tool of ANALYTICS) {
      expect(tool.pattern.test(valid[tool.id] ?? '')).toBe(true);
      expect(tool.pattern.test(invalid[tool.id] ?? '')).toBe(false);
    }
  });

  it('requires a valid ID only when the tool is on', () => {
    const parse = (analytics: unknown) => integrationsSettingsSchema.safeParse({ analytics });
    expect(parse({ ga4: { enabled: false, id: '' } }).success).toBe(true);
    expect(parse({ ga4: { enabled: true, id: '' } }).success).toBe(false);
    expect(parse({ ga4: { enabled: true, id: 'G-ABC123XYZ4' } }).success).toBe(true);
    expect(parse({ ga4: { enabled: false, id: 'nonsense' } }).success).toBe(false);
  });

  it('keeps v1.6 settings valid (everything off)', () => {
    const settings = siteSettingsSchema.parse({});
    expect(settings.integrations.email.provider).toBe('none');
    expect(settings.integrations.analytics.ga4).toEqual({ enabled: false, id: '' });
    expect(settings.forms.defaultRecipients).toEqual([]);
  });
});

describe('email settings', () => {
  it('needs a sender and an SMTP server once a provider is chosen', () => {
    expect(emailIntegrationSchema.safeParse({ provider: 'none' }).success).toBe(true);
    expect(emailIntegrationSchema.safeParse({ provider: 'resend', from: '' }).success).toBe(false);
    expect(
      emailIntegrationSchema.safeParse({ provider: 'resend', from: 'Site <forms@example.com>' })
        .success,
    ).toBe(true);
    expect(
      emailIntegrationSchema.safeParse({ provider: 'smtp', from: 'forms@example.com' }).success,
    ).toBe(false);
  });

  it('refuses a sender with line breaks (header injection)', () => {
    expect(MAIL_FROM_PATTERN.test('Site <forms@example.com>')).toBe(true);
    expect(MAIL_FROM_PATTERN.test('forms@example.com\r\nBcc: x@y.z')).toBe(false);
  });
});

describe('scripts and CSP of integrations that are on', () => {
  const off = Object.fromEntries(
    Object.values(AnalyticsId).map((id) => [id, { enabled: false, id: '' }]),
  ) as Parameters<typeof consentScripts>[0];

  it('loads nothing when everything is off', () => {
    expect(consentScripts(off)).toEqual([]);
    expect(integrationCspSources(off)).toEqual({});
  });

  it('builds the GA4 scripts and adds only its origins to the site CSP', () => {
    const settings = { ...off, ga4: { enabled: true, id: 'G-ABC123XYZ4' } };
    const scripts = consentScripts(settings);
    expect(scripts.map((script) => script.id)).toEqual(['ga4-src', 'ga4-init']);
    expect(scripts[0]?.src).toContain('G-ABC123XYZ4');
    const csp = staticPageCsp(mergeCspSources({}, integrationCspSources(settings)));
    expect(csp).toContain('https://www.googletagmanager.com');
    expect(csp).not.toContain('hotjar');
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('ignores a tool that is on with an invalid ID', () => {
    expect(consentScripts({ ...off, hotjar: { enabled: true, id: 'x' } })).toEqual([]);
  });

  it('describes every tool', () => {
    for (const tool of ANALYTICS)
      expect(analyticsDefinition(tool.id).csp.scriptSrc?.length).toBeGreaterThan(0);
  });

  it('merges project and integration sources without duplicates', () => {
    const merged = mergeCspSources(
      { scriptSrc: ['https://a.example'] },
      { scriptSrc: ['https://a.example', 'https://b.example'] },
    );
    expect(merged.scriptSrc).toEqual(['https://a.example', 'https://b.example']);
  });
});

describe('default recipients', () => {
  const own = formDestinationsSchema.parse({
    email: { enabled: true, recipients: ['own@example.com'] },
  });

  it('applies to a form with no list of its own', () => {
    const result = withDefaultRecipients(undefined, ['team@example.com']);
    expect(result?.email).toEqual({ enabled: true, recipients: ['team@example.com'] });
    expect(
      withDefaultRecipients(formDestinationsSchema.parse({}), ['a@example.com'])?.email.enabled,
    ).toBe(true);
  });

  it('keeps the form’s own list as an override', () => {
    expect(withDefaultRecipients(own, ['team@example.com'])?.email.recipients).toEqual([
      'own@example.com',
    ]);
  });

  it('does nothing without default recipients', () => {
    expect(withDefaultRecipients(undefined, [])).toBeUndefined();
  });

  it('knows when nobody receives requests', () => {
    const forms = (value: unknown) => siteSettingsSchema.parse({ forms: value }).forms;
    expect(hasRecipients(forms({}))).toBe(false);
    expect(hasRecipients(forms({ defaultRecipients: ['a@example.com'] }))).toBe(true);
    expect(hasRecipients(forms({ destinations: { contact: own } }))).toBe(true);
  });
});
