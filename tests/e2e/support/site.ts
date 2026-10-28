import { registry } from '@/content';
import type { AnyCollection } from '@/core/content/collection';
import type { AnyPage } from '@/core/content/define';
import type { AnyForm } from '@/core/forms/define';
import { projectConfig } from '@project/config';

/**
 * What the project's site has, read from its registry and config, so core specs
 * work on the demo and on any real project (after `pnpm demo:remove`). Demo specs
 * (tests/e2e/demo) assert the demo content itself.
 */

export { DEMO_PRESENT } from './demo';

const pages: readonly AnyPage[] = registry.pages;
const forms: readonly AnyForm[] = registry.forms;
const collections: readonly AnyCollection[] = registry.collections;

/** Every project has a home page. */
export const HOME_PATH = '/';

/** A page other than home if the site has one (gate, consent, analytics tests), else home. */
export const SAMPLE_PATH = pages.find((page) => page.path !== HOME_PATH)?.path ?? HOME_PATH;

/** The first page of the registry (opened in the admin editor). */
export const FIRST_PAGE_ID = pages[0]!.id;

/** Number of sections of that page (one section: no "Expand all"). */
export const FIRST_PAGE_SECTIONS = pages[0]!.sections.length;

/** The first form, if the project has one. */
export const FIRST_FORM_ID: string | undefined = forms[0]?.id;

export const HAS_COLLECTIONS = collections.length > 0;
export const HAS_FORMS = forms.length > 0;

/** A configured language other than the main one, if any (its URLs are prefixed). */
export const OTHER_LOCALE: string | undefined = projectConfig.localeCodes.find(
  (code) => code !== projectConfig.defaultLocale,
);

/** Its name in the language switcher. */
export const OTHER_LOCALE_LABEL: string | undefined = projectConfig.supportedLocales.find(
  (locale) => locale.code === OTHER_LOCALE,
)?.label;

/** `/uk/about` for `uk` + `/about`; the main language has no prefix. */
export function localePath(locale: string, pagePath: string): string {
  if (locale === projectConfig.defaultLocale) return pagePath;
  return pagePath === HOME_PATH ? `/${locale}` : `/${locale}${pagePath}`;
}
