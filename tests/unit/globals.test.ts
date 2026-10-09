import { describe, expect, it } from 'vitest';

import { registry } from '@/content';
import { mailtoHref, telHref } from '@/core/content/contact-links';
import { defineSection } from '@/core/content/define';
import { f } from '@/core/content/fields';
import { defineGlobal, globalKey } from '@/core/content/global';
import { createRegistry } from '@/core/content/registry';
import { fieldSchema } from '@/core/content/validation';

describe('email and phone fields', () => {
  it('validate when filled and respect required', () => {
    const email = fieldSchema(f.email());
    expect(email.safeParse('').success).toBe(true);
    expect(email.safeParse('team@example.com').success).toBe(true);
    expect(email.safeParse('not an email').success).toBe(false);
    expect(fieldSchema(f.email({ required: true })).safeParse('').success).toBe(false);

    const phone = fieldSchema(f.phone());
    expect(phone.safeParse('+380 (44) 000-00-00').success).toBe(true);
    expect(phone.safeParse('call me').success).toBe(false);
  });

  it('build mailto and tel links', () => {
    expect(mailtoHref(' hi@example.com ')).toBe('mailto:hi@example.com');
    expect(telHref('+380 (44) 000-00-00')).toBe('tel:+380440000000');
    expect(telHref('044 000 00 00')).toBe('tel:0440000000');
  });
});

describe('globals', () => {
  const footer = defineGlobal({
    id: 'footer',
    label: 'Footer',
    sections: [defineSection({ id: 'legal', label: 'Legal', fields: { line: f.text() } })],
  });

  it('are registered without routes and keyed apart from pages', () => {
    const withGlobals = createRegistry({ pages: [], globals: [footer] });
    expect(withGlobals.globalById('footer')?.label).toBe('Footer');
    expect(globalKey('footer')).toBe('global:footer');
    expect(() => createRegistry({ pages: [], globals: [footer, footer] })).toThrow(/Duplicate/);
    expect(registry.globalById('site')?.label).toBe('Header & footer');
  });

  it('reject duplicate sections', () => {
    const section = defineSection({ id: 'a', label: 'A', fields: {} });
    expect(() => defineGlobal({ id: 'x', label: 'X', sections: [section, section] })).toThrow(
      /duplicate/,
    );
  });
});
