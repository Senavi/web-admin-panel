import { registry } from '@/content';
import type { AnyPage } from '@/core/content/define';

/**
 * Pages of the project's registry for unit tests of core behaviour, so they pass on
 * the demo and on a project after `pnpm demo:remove` (which keeps a home page).
 * Tests of the demo content itself live in tests/unit/demo.
 */
const pages: readonly AnyPage[] = registry.pages;

/** A page other than home if there is one, else home. */
export const SAMPLE_PAGE: AnyPage = pages.find((page) => page.path !== '/') ?? pages[0]!;

/** `/uk/about` for `uk` + `/about`. */
export function prefixedPath(locale: string, pagePath: string): string {
  return pagePath === '/' ? `/${locale}` : `/${locale}${pagePath}`;
}
