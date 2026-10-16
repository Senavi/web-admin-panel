/**
 * PROJECT: next-intl request config. Site UI strings are the project's message
 * files (src/site/messages/<locale>.json, registered in src/content/ui-texts.ts)
 * merged with the texts admins edit; a language without a file starts from the
 * main language's texts.
 */
import { locale as rootLocale } from 'next/root-params';
import { getRequestConfig } from 'next-intl/server';

import { projectConfig } from '@project/config';

import { getSiteMessages } from '@/core/ui-texts/loader';

export default getRequestConfig(async ({ locale: explicit }) => {
  const locale = explicit ?? (await rootLocale()) ?? projectConfig.defaultLocale;
  return { locale, messages: await getSiteMessages(locale) };
});
