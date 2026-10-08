/**
 * PROJECT: next-intl request config. Site UI strings (not managed in the admin)
 * live in src/site/messages/<locale>.json.
 */
import { locale as rootLocale } from 'next/root-params';
import { getRequestConfig } from 'next-intl/server';

import { projectConfig } from '@project/config';

export default getRequestConfig(async ({ locale: explicit }) => {
  const candidate = explicit ?? (await rootLocale());
  const locale =
    projectConfig.localeCodes.find((code) => code === candidate) ?? projectConfig.defaultLocale;
  const messages = (await import(`../messages/${locale}.json`)) as {
    default: Record<string, unknown>;
  };
  return { locale, messages: messages.default };
});
