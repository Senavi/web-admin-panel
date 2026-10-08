import 'server-only';

import { projectConfig } from '@project/config';

import { getSiteSettings } from '@/core/settings/loader';

export interface LocaleInfo {
  readonly code: string;
  readonly label: string;
  readonly dir: 'ltr' | 'rtl';
}

const byCode = new Map(
  projectConfig.supportedLocales.map((locale) => [locale.code as string, locale]),
);

export function localeInfo(code: string): LocaleInfo {
  const locale = byCode.get(code);
  return { code, label: locale?.label ?? code, dir: locale?.dir ?? 'ltr' };
}

/** Enabled locales and the default locale from Settings → General (cached). */
export async function getLocaleSettings(): Promise<{
  defaultLocale: string;
  enabledLocales: string[];
}> {
  const { general } = await getSiteSettings();
  return { defaultLocale: general.defaultLocale, enabledLocales: general.enabledLocales };
}

export async function isEnabledLocale(locale: string): Promise<boolean> {
  return (await getLocaleSettings()).enabledLocales.includes(locale);
}
