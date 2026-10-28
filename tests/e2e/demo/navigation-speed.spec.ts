import { expect, test } from '../support/test';

import { admin } from '../support/admin';
import { login } from '../support/auth';
import { ADMIN_ROUTE_SEQUENCE, SITE_ROUTE_SEQUENCE, timeNavigation } from '../support/navigation';
import { E2E_ADMIN } from '../support/users';

/** Warm client navigations on a production build must stay fast (docs/DECISIONS.md D-085). */
const BUDGET_MS = 500;
const SITE_PAGES = SITE_ROUTE_SEQUENCE.slice(0, 4);
const ADMIN_PAGES = ADMIN_ROUTE_SEQUENCE.slice(0, 4).map((path) => admin(path));

test.describe('navigation speed', () => {
  test.skip(!process.env.E2E_BASE_URL, 'measured on a production build (pnpm e2e:prod / CI)');

  test(`warm site and admin navigations take less than ${BUDGET_MS} ms`, async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, E2E_ADMIN);
    const results: Array<[string, number]> = [];
    for (const round of ['warm-up', 'measure']) {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      for (const path of SITE_PAGES) {
        const ms = await timeNavigation(page, path);
        if (round === 'measure') results.push([path, ms]);
      }
      await page.goto(admin());
      await page.waitForLoadState('networkidle');
      for (const path of ADMIN_PAGES) {
        const ms = await timeNavigation(page, path);
        if (round === 'measure') results.push([path, ms]);
      }
    }
    console.info(results.map(([path, ms]) => `${path}: ${ms} ms`).join('\n'));
    for (const [path, ms] of results) expect(ms, `${path} took ${ms} ms`).toBeLessThan(BUDGET_MS);
  });
});
