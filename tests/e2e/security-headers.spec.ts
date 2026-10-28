import { expect, test } from './support/test';

import { login } from './support/auth';
import { collectCspViolations } from './support/csp';
import { E2E_ADMIN } from './support/users';
import { admin } from './support/admin';
import { FIRST_PAGE_ID, HOME_PATH, localePath, OTHER_LOCALE, SAMPLE_PATH } from './support/site';

test('site responses carry security headers and a CSP', async ({ request }) => {
  const response = await request.get(SAMPLE_PATH, {
    headers: { 'user-agent': 'Mozilla/5.0 Chrome/150' },
  });
  const headers = response.headers();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).toContain("object-src 'none'");
});

test('admin responses use a nonce-based CSP', async ({ page }) => {
  const response = await page.goto(admin('/login'));
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
});

test('pages run without CSP violations (site, dashboard, editor, settings)', async ({ page }) => {
  const violations = collectCspViolations(page);
  await page.goto(HOME_PATH);
  await page.goto(SAMPLE_PATH);
  if (OTHER_LOCALE) await page.goto(localePath(OTHER_LOCALE, SAMPLE_PATH));
  await login(page, E2E_ADMIN);
  await page.goto(admin('?range=7d'));
  await expect(page.getByRole('heading', { name: 'Traffic' })).toBeVisible();
  await page.goto(admin(`/pages/${FIRST_PAGE_ID}`));
  await expect(page.locator('form[data-hydrated]')).toBeVisible();
  await page.goto(admin('/settings'));
  await expect(page.locator('form[aria-label="General"][data-hydrated]')).toBeVisible();
  expect(violations).toEqual([]);
});
