import { describe, expect, it } from 'vitest';

import {
  languageTransitions,
  languageState,
  LanguageState,
  selectedLocales,
} from '@/core/i18n/language-state';
import {
  DEFAULT_FONT_SCRIPTS,
  findLanguage,
  isKnownLanguage,
  languageWarnings,
  LANGUAGES,
} from '@/core/i18n/languages';
import { decideLocaleRoute } from '@/core/i18n/routing';
import { generalSettingsSchema } from '@/core/settings/schema';

const base = { enabledLocales: ['en', 'uk'], draftLocales: [] as string[], defaultLocale: 'en' };

describe('master language list', () => {
  it('covers at least the 100 most used languages with unique codes', () => {
    expect(LANGUAGES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(LANGUAGES.map((language) => language.code)).size).toBe(LANGUAGES.length);
  });

  it('knows names, direction and script', () => {
    expect(findLanguage('uk')).toMatchObject({ native: 'Українська', dir: 'ltr', script: 'Cyrl' });
    expect(findLanguage('ar')?.dir).toBe('rtl');
    expect(isKnownLanguage('xx')).toBe(false);
  });

  it('warns about right-to-left languages and scripts the fonts do not cover', () => {
    expect(languageWarnings('uk', DEFAULT_FONT_SCRIPTS)).toEqual([]);
    expect(languageWarnings('ar', DEFAULT_FONT_SCRIPTS)).toEqual(['rtl', 'font']);
    expect(languageWarnings('ja', DEFAULT_FONT_SCRIPTS)).toEqual(['font']);
    expect(languageWarnings('pl', [...DEFAULT_FONT_SCRIPTS, 'Latx'])).toEqual([]);
  });
});

describe('language states', () => {
  it('adds new languages as drafts without touching the others', () => {
    const next = languageTransitions.add(base, 'de');
    expect(next.draftLocales).toEqual(['de']);
    expect(next.enabledLocales).toEqual(['en', 'uk']);
    expect(languageState(next, 'de')).toBe(LanguageState.Draft);
    expect(selectedLocales(next)).toEqual(['en', 'uk', 'de']);
  });

  it('publishes and unpublishes, never the main language', () => {
    const drafted = languageTransitions.add(base, 'de');
    const published = languageTransitions.publish(drafted, 'de');
    expect(published.enabledLocales).toEqual(['en', 'uk', 'de']);
    expect(published.draftLocales).toEqual([]);
    expect(languageTransitions.unpublish(published, 'de').draftLocales).toEqual(['de']);
    expect(languageTransitions.unpublish(base, 'en')).toBe(base);
  });

  it('removes a language but keeps the main one', () => {
    expect(languageTransitions.remove(base, 'uk').enabledLocales).toEqual(['en']);
    expect(languageTransitions.remove(base, 'en')).toBe(base);
  });

  it('makes only a published language the main one', () => {
    const drafted = languageTransitions.add(base, 'de');
    expect(languageTransitions.makeMain(drafted, 'de').defaultLocale).toBe('en');
    expect(languageTransitions.makeMain(drafted, 'uk').defaultLocale).toBe('uk');
  });
});

describe('general settings with languages', () => {
  it('keeps v1.6 settings valid: no drafts, current locales published', () => {
    const parsed = generalSettingsSchema.parse({
      enabledLocales: ['en', 'uk'],
      defaultLocale: 'en',
    });
    expect(parsed.draftLocales).toEqual([]);
  });

  it('accepts any known language and rejects unknown, overlapping or unpublished-main', () => {
    expect(
      generalSettingsSchema.safeParse({
        enabledLocales: ['en', 'de'],
        draftLocales: ['fr'],
        defaultLocale: 'en',
      }).success,
    ).toBe(true);
    expect(
      generalSettingsSchema.safeParse({ enabledLocales: ['en', 'xx'], defaultLocale: 'en' })
        .success,
    ).toBe(false);
    expect(
      generalSettingsSchema.safeParse({
        enabledLocales: ['en'],
        draftLocales: ['en'],
        defaultLocale: 'en',
      }).success,
    ).toBe(false);
    expect(
      generalSettingsSchema.safeParse({
        enabledLocales: ['en'],
        draftLocales: ['de'],
        defaultLocale: 'de',
      }).success,
    ).toBe(false);
  });
});

describe('routing of draft languages', () => {
  const state = {
    defaultLocale: 'en',
    enabledLocales: ['en', 'uk'],
    draftLocales: ['de'],
    supportedLocales: ['en', 'uk', 'de'],
  };

  it('hides drafts from visitors and shows them to staff', () => {
    expect(decideLocaleRoute('/de/about', state, { isBot: false })).toEqual({ type: 'not-found' });
    expect(decideLocaleRoute('/de/about', state, { isBot: false, staff: true })).toEqual({
      type: 'pass',
      locale: 'de',
    });
  });

  it('never negotiates a draft language from Accept-Language', () => {
    const decision = decideLocaleRoute('/', state, { isBot: false, acceptLanguage: 'de' });
    expect(decision).toMatchObject({ type: 'rewrite', locale: 'en' });
  });

  it('treats a language that is not selected as an ordinary path', () => {
    expect(decideLocaleRoute('/fr/about', state, { isBot: false })).toMatchObject({
      type: 'rewrite',
      pathname: '/en/fr/about',
    });
  });
});
