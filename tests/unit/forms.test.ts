import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/core/auth/secret', () => ({ getAuthSecret: () => 'unit-test-secret-0123456789abcdef' }));

import { defineForm, FormFieldType, MESSAGES_SECTION, optionTextKey } from '@/core/forms/define';
import { plainTextBody, webhookSignature } from '@/core/forms/delivery';
import { csvCell, previewOf } from '@/core/forms/inbox';
import { checkFormToken, issueFormToken, MIN_FILL_MS, TokenCheck } from '@/core/forms/spam';
import { FormErrorCode, validateSubmission, valuesFromFormData } from '@/core/forms/validation';
import { defineProjectConfig, TURNSTILE_ORIGIN } from '@/core/project/define';
import { lockSecondsFor } from '@/core/security/throttle';
import { FORM_IP_POLICY } from '@/core/forms/spam';

const form = defineForm({
  id: 'test',
  label: 'Test form',
  fields: {
    name: { type: FormFieldType.Text, required: true, max: 10 },
    email: { type: FormFieldType.Email, required: true },
    phone: { type: FormFieldType.Tel },
    topic: { type: FormFieldType.Select, options: ['a', 'b-c'] },
    consent: { type: FormFieldType.Consent, required: true },
  },
});

describe('defineForm', () => {
  it('derives an editable texts schema', () => {
    const ids = form.texts.sections.map((section) => section.id);
    expect(ids).toEqual(['name', 'email', 'phone', 'topic', 'consent', MESSAGES_SECTION]);
    const topic = form.texts.sections.find((section) => section.id === 'topic');
    expect(Object.keys(topic?.fields ?? {})).toContain(optionTextKey('b-c'));
    expect(form.texts.sections.find((s) => s.id === 'consent')?.fields.label?.kind).toBe(
      'richText',
    );
  });

  it('rejects bad definitions', () => {
    expect(() =>
      defineForm({ id: 'x', label: 'X', fields: { topic: { type: FormFieldType.Select } } }),
    ).toThrow(/needs options/);
    expect(() =>
      defineForm({ id: 'x', label: 'X', fields: { messages: { type: FormFieldType.Text } } }),
    ).toThrow(/messages/);
  });
});

describe('submission validation', () => {
  const data = (entries: Record<string, string>) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(entries)) formData.set(key, value);
    return valuesFromFormData(form, formData);
  };

  it('accepts valid input and reads checkboxes', () => {
    const result = validateSubmission(
      form,
      data({ name: ' Ada ', email: 'ada@example.com', topic: 'b-c', consent: 'on' }),
    );
    expect(result).toEqual({
      ok: true,
      values: { name: 'Ada', email: 'ada@example.com', phone: '', topic: 'b-c', consent: true },
    });
  });

  it('returns one error code per invalid field', () => {
    const result = validateSubmission(
      form,
      data({ name: 'x'.repeat(11), email: 'nope', phone: 'call me', topic: 'z' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual({
      name: FormErrorCode.TooLong,
      email: FormErrorCode.InvalidEmail,
      phone: FormErrorCode.InvalidPhone,
      topic: FormErrorCode.InvalidOption,
      consent: FormErrorCode.Consent,
    });
    const empty = validateSubmission(form, data({}));
    expect(!empty.ok && empty.errors.name).toBe(FormErrorCode.Required);
  });
});

describe('spam protection', () => {
  it('signed timing tokens enforce a minimum fill time and expiry', async () => {
    const issued = Date.UTC(2026, 0, 1);
    const token = await issueFormToken('test', issued);
    expect(await checkFormToken('test', token, issued + 500)).toBe(TokenCheck.TooFast);
    expect(await checkFormToken('test', token, issued + MIN_FILL_MS + 1)).toBe(TokenCheck.Ok);
    expect(await checkFormToken('test', token, issued + 2 * 24 * 3600 * 1000)).toBe(
      TokenCheck.Expired,
    );
    expect(await checkFormToken('other', token, issued + MIN_FILL_MS + 1)).toBe(TokenCheck.Invalid);
    expect(await checkFormToken('test', `${issued}.forged`, issued + MIN_FILL_MS + 1)).toBe(
      TokenCheck.Invalid,
    );
    expect(await checkFormToken('test', undefined)).toBe(TokenCheck.Invalid);
  });

  it('locks a visitor after five submissions', () => {
    expect(lockSecondsFor(4, FORM_IP_POLICY)).toBe(0);
    expect(lockSecondsFor(5, FORM_IP_POLICY)).toBeGreaterThan(0);
  });

  it('adds Turnstile CSP sources when configured', () => {
    const config = defineProjectConfig({
      name: 'x',
      supportedLocales: [{ code: 'en', label: 'English' }],
      defaultLocale: 'en',
      forms: { turnstile: { siteKey: '0x4AAAAAAAtest' } },
    });
    expect(config.csp.scriptSrc).toContain(TURNSTILE_ORIGIN);
    expect(config.csp.frameSrc).toContain(TURNSTILE_ORIGIN);
  });
});

describe('delivery and export', () => {
  const submission = {
    id: '00000000-0000-4000-8000-000000000001',
    formId: 'test',
    locale: 'en',
    pagePath: '/contact',
    createdAt: new Date('2026-01-01T10:00:00Z'),
    data: { name: 'Ada', email: 'ada@example.com', phone: '', topic: 'a', consent: true },
  };

  it('signs webhook bodies with HMAC-SHA256', () => {
    const body = '{"a":1}';
    const expected = createHmac('sha256', 'secret').update(body).digest('hex');
    expect(webhookSignature('secret', body)).toBe(`sha256=${expected}`);
  });

  it('builds a plain-text email body', () => {
    const text = plainTextBody(form, submission);
    expect(text).toContain('New submission: Test form');
    expect(text).toContain('Email:\nada@example.com');
    expect(text).toContain('Consent:\nYes');
  });

  it('escapes CSV cells against formula injection', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('plain')).toBe('"plain"');
    expect(csvCell('-1')).toBe(`"'-1"`);
    expect(previewOf(form, submission.data)).toBe('Ada · ada@example.com');
  });
});
