import 'server-only';

import { redirect } from 'next/navigation';

import { localeInfo } from '@/core/i18n/locales';
import { getRequestSettings } from '@/core/settings/request';

/**
 * Locale of an editor screen from `?locale=` (default locale when missing;
 * redirects when the requested locale isn't enabled) plus the switcher options.
 */
export async function resolveEditorLocale(
  query: Record<string, string | string[] | undefined>,
  basePath: string,
) {
  const { general } = await getRequestSettings();
  const requested = typeof query.locale === 'string' ? query.locale : general.defaultLocale;
  if (!general.enabledLocales.includes(requested)) {
    redirect(`${basePath}${basePath.includes('?') ? '&' : '?'}locale=${general.defaultLocale}`);
  }
  return {
    locale: requested,
    defaultLocale: general.defaultLocale,
    locales: general.enabledLocales.map((code) => ({ code, label: localeInfo(code).label })),
  };
}
