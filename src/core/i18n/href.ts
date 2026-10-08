import 'server-only';

import { locale as rootLocale } from 'next/root-params';

import { getLocaleSettings } from './locales';
import { localizedPath } from './routing';

/** True for site-relative paths like `/about` (not `//host`, not `#anchor`). */
export function isInternalHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

/**
 * Adds the locale prefix to internal content links (`/about` → `/uk/about`).
 * Content stores locale-neutral paths; external URLs are returned unchanged.
 */
export async function localizeHref(href: string, locale?: string): Promise<string> {
  if (!isInternalHref(href)) return href;
  const { defaultLocale } = await getLocaleSettings();
  const current = locale ?? (await rootLocale()) ?? defaultLocale;
  const [path = '/', hash] = href.split('#');
  const localized = localizedPath(path, current, defaultLocale);
  return hash ? `${localized}#${hash}` : localized;
}
