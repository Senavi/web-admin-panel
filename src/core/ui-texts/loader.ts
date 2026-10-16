import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';
import { getLocaleSettings } from '@/core/i18n/locales';
import { isPreviewMode } from '@/core/preview/mode';

import { type FlatTexts, type MessageTree, resolveMessages } from './model';
import { uiTextCatalog } from './project-catalog';
import { readAllUiTexts } from './repository';

/**
 * Saved texts of every namespace for the given languages (cached; tagged per
 * namespace, so saving a text refreshes the pages that show it).
 */
async function getUiOverrides(
  locale: string,
  mainLocale: string,
): Promise<Record<string, Record<string, FlatTexts>>> {
  'use cache';
  cacheLife('max');
  for (const namespace of uiTextCatalog.namespaceIds) cacheTag(CacheTag.ui(namespace));
  if (isPreviewMode()) return {};
  const stored = await readAllUiTexts(
    await getDb(),
    locale === mainLocale ? [locale] : [locale, mainLocale],
  );
  return Object.fromEntries(
    Object.entries(stored).map(([namespace, rows]) => [
      namespace,
      Object.fromEntries(Object.entries(rows).map(([locale, row]) => [locale, row.data])),
    ]),
  );
}

/** Everything next-intl renders for a language: files and admin edits merged (see `resolveUiText`). */
export async function getSiteMessages(locale: string): Promise<MessageTree> {
  const { defaultLocale } = await getLocaleSettings();
  const overrides = await getUiOverrides(locale, defaultLocale);
  return resolveMessages(uiTextCatalog, overrides, locale, defaultLocale);
}
