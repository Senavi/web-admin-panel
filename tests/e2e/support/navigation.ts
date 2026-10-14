import type { Page } from '@playwright/test';

/** Site pages reachable from the header (and the logo back to home). */
export const SITE_ROUTE_SEQUENCE = ['/about', '/about/team', '/blog', '/contact', '/'];
/** Admin screens reachable from the sidebar and the Pages tree (sub paths of the admin). */
export const ADMIN_ROUTE_SEQUENCE = [
  '/pages',
  '/pages/home',
  '/managers',
  '/settings',
  '/security',
  '',
];

export interface NavigationTiming {
  /** Click → the page reacts (new URL shown, with a loading skeleton if the data isn't there yet). */
  readonly feedbackMs: number;
  /** Click → the new page's final content (new <h1>, no skeleton left). */
  readonly contentMs: number;
}

/** Clicks the visible link to `href` and measures feedback and final content. */
export async function measureNavigation(page: Page, href: string): Promise<NavigationTiming> {
  const before = await page.locator('h1').first().textContent();
  const link = page.locator(`a[href="${href}"]`).filter({ visible: true }).first();
  const started = Date.now();
  await link.click();
  await page.waitForURL((url) => url.pathname === href, { timeout: 30_000 });
  const feedbackMs = Date.now() - started;
  await page.waitForFunction(
    (previous) => {
      const heading = document.querySelector('h1');
      const loading = document.querySelector('[data-slot="skeleton"], [aria-busy="true"]');
      return Boolean(heading && heading.textContent !== previous && !loading);
    },
    before,
    { timeout: 30_000 },
  );
  return { feedbackMs, contentMs: Date.now() - started };
}

/** Click → final content, in milliseconds. */
export async function timeNavigation(page: Page, href: string): Promise<number> {
  return (await measureNavigation(page, href)).contentMs;
}
