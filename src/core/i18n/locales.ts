import 'server-only';

import { projectConfig } from '@project/config';

import { getSiteSettings } from '@/core/settings/loader';

import { findLanguage } from './languages';
import { selectedLocales } from './language-state';

export interface LocaleInfo {
  readonly code: string;
  readonly label: string;
  readonly dir: 'ltr' | 'rtl';
}

const byCode = new Map(
  projectConfig.supportedLocales.map((locale) => [locale.code as string, locale]),
);

/** Native name and direction of a language (the master list first, then the project config). */
export function localeInfo(code: string): LocaleInfo {
  const language = findLanguage(code);
  const locale = byCode.get(code);
  return {
    code,
    label: locale?.label ?? language?.native ?? code,
    dir: locale?.dir ?? language?.dir ?? 'ltr',
  };
}

/** Published and draft languages and the main language from Settings → General (cached). */
export async function getLocaleSettings(): Promise<{
  defaultLocale: string;
  /** Published languages. */
  enabledLocales: string[];
  draftLocales: string[];
}> {
  const { general } = await getSiteSettings();
  return {
    defaultLocale: general.defaultLocale,
    enabledLocales: general.enabledLocales,
    draftLocales: general.draftLocales,
  };
}

/** A published language. */
export async function isEnabledLocale(locale: string): Promise<boolean> {
  return (await getLocaleSettings()).enabledLocales.includes(locale);
}

/**
 * A language the site can render: published, or a draft that staff preview (the
 * request proxy answers 404 for drafts without a staff session).
 */
export async function isRoutableLocale(locale: string): Promise<boolean> {
  const { enabledLocales, draftLocales } = await getLocaleSettings();
  return selectedLocales({ enabledLocales, draftLocales }).includes(locale);
}
