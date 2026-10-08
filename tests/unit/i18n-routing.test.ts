import { describe, expect, it } from 'vitest';

import {
  decideLocaleRoute,
  localizedPath,
  negotiateLocale,
  splitLocale,
} from '@/core/i18n/routing';

const state = {
  defaultLocale: 'en',
  enabledLocales: ['en', 'uk'],
  supportedLocales: ['en', 'uk', 'de'],
};
const human = { isBot: false } as const;

describe('locale routing', () => {
  it('rewrites unprefixed paths to the default locale', () => {
    expect(decideLocaleRoute('/about', state, human)).toEqual({
      type: 'rewrite',
      pathname: '/en/about',
      locale: 'en',
    });
    expect(decideLocaleRoute('/', state, human)).toEqual({
      type: 'rewrite',
      pathname: '/en',
      locale: 'en',
    });
  });

  it('serves prefixed non-default locales and redirects the default prefix away', () => {
    expect(decideLocaleRoute('/uk/about', state, human)).toEqual({ type: 'pass', locale: 'uk' });
    expect(decideLocaleRoute('/en/about', state, human)).toEqual({
      type: 'redirect',
      pathname: '/about',
      locale: 'en',
    });
  });

  it('returns not-found for supported but disabled locales', () => {
    expect(decideLocaleRoute('/de/about', state, human)).toEqual({ type: 'not-found' });
  });

  it('detects the language only on the first visit to / and never for bots', () => {
    const accept = 'uk-UA,uk;q=0.9,en;q=0.8';
    expect(decideLocaleRoute('/', state, { ...human, acceptLanguage: accept })).toMatchObject({
      type: 'redirect',
      pathname: '/uk',
    });
    expect(decideLocaleRoute('/', state, { isBot: true, acceptLanguage: accept })).toMatchObject({
      type: 'rewrite',
    });
    expect(
      decideLocaleRoute('/', state, { ...human, acceptLanguage: accept, cookieLocale: 'en' }),
    ).toMatchObject({ type: 'rewrite' });
    expect(decideLocaleRoute('/about', state, { ...human, acceptLanguage: accept })).toMatchObject({
      type: 'rewrite',
    });
  });

  it('helpers', () => {
    expect(splitLocale('/uk', ['uk'])).toEqual({ locale: 'uk', rest: '/' });
    expect(localizedPath('/', 'uk', 'en')).toBe('/uk');
    expect(localizedPath('/about', 'en', 'en')).toBe('/about');
    expect(negotiateLocale('de-DE,en-US;q=0.5', ['en', 'uk'])).toBe('en');
    expect(negotiateLocale('fr', ['en', 'uk'])).toBeNull();
  });
});
