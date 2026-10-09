import { expect, type Page, test } from '@playwright/test';

import { login } from './support/auth';
import { E2E_ADMIN } from './support/users';

function collectCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /Content Security Policy|Refused to (execute|load|apply)/i.test(message.text())
    ) {
      violations.push(message.text());
    }
  });
  return violations;
}

test('site responses carry security headers and a CSP', async ({ request }) => {
  const response = await request.get('/about', {
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
  const response = await page.goto('/admin/login');
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
});

test('pages run without CSP violations (site, blog, forms, editor, dashboard)', async ({
  page,
}) => {
  const violations = collectCspViolations(page);
  await page.goto('/');
  await page.goto('/uk/about/team');
  await page.goto('/blog');
  await page.goto('/blog/hello-world');
  await page.goto('/contact');
  await expect(page.locator('form#form-contact input[name="_t"]')).toBeAttached();
  await login(page, E2E_ADMIN);
  await page.goto('/admin?range=7d');
  await expect(page.getByRole('heading', { name: 'Traffic' })).toBeVisible();
  await page.goto('/admin/pages/about');
  await expect(page.locator('form[data-hydrated]')).toBeVisible();
  await page.goto('/admin/settings');
  await expect(page.locator('form[aria-label="General"][data-hydrated]')).toBeVisible();
  await page.goto('/admin/pages/collections/blog');
  await page.goto('/admin/pages/forms/contact');
  await expect(page.getByRole('table', { name: 'Submissions' })).toBeVisible();
  expect(violations).toEqual([]);
});
