/**
 * PROJECT: next-intl request config. Site UI strings live in
 * src/site/messages/<locale>.json. A language added in the admin that has no
 * file yet uses the project's default language until its texts are edited.
 */
import { locale as rootLocale } from 'next/root-params';
import { getRequestConfig } from 'next-intl/server';

import { projectConfig } from '@project/config';

type Messages = { default: Record<string, unknown> };

async function loadMessages(locale: string): Promise<Messages | null> {
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(locale)) return null;
  try {
    return (await import(`../messages/${locale}.json`)) as Messages;
  } catch {
    return null;
  }
}

export default getRequestConfig(async ({ locale: explicit }) => {
  const locale = explicit ?? (await rootLocale()) ?? projectConfig.defaultLocale;
  const messages =
    (await loadMessages(locale)) ?? (await loadMessages(projectConfig.defaultLocale));
  return { locale, messages: messages?.default ?? {} };
});
