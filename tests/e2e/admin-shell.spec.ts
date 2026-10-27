import { type Page } from '@playwright/test';
import { expect, test } from './support/test';

import { login } from './support/auth';
import { setDeveloperMode } from './support/developer';
import { E2E_ADMIN, E2E_MANAGER } from './support/users';
import { admin, adminRe } from './support/admin';

const sidebar = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Admin navigation' })
    .or(page.locator('[data-sidebar="sidebar"]'));

test.describe('admin shell', () => {
  test('dates render without a hydration mismatch in a non-UTC timezone', async ({ browser }) => {
    const context = await browser.newContext({ timezoneId: 'Europe/Kyiv' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await login(page, E2E_ADMIN);
    for (const path of [admin('/security'), admin('/security/activity'), admin('/managers')]) {
      await page.goto(path);
      await expect(page.locator('time').first()).toBeVisible();
    }
    // Hydrated: local time, no "UTC" suffix.
    await expect(page.locator('time', { hasText: 'UTC' })).toHaveCount(0);
    expect(errors.filter((text) => /hydrat|#418|#425/i.test(text))).toEqual([]);
    await context.close();
  });

  test('the local DB banner shows only in developer mode', async ({ page }) => {
    // E2E runs on PGlite unless DATABASE_URL is set (CI Postgres), where it must be absent.
    const expectBanner = !process.env.DATABASE_URL;
    await page.goto(admin('/login'));
    await expect(page.getByTestId('local-db-banner')).toHaveCount(0);
    await login(page, E2E_ADMIN);
    await page.goto(admin());
    await expect(page.getByTestId('local-db-banner')).toHaveCount(0);
    await setDeveloperMode(page, true);
    for (const path of [admin(), admin('/account'), admin('/pages'), admin('/settings')]) {
      await page.goto(path);
      await expect(page.getByTestId('local-db-banner')).toHaveCount(expectBanner ? 1 : 0);
    }
    await setDeveloperMode(page, false);
    await expect(page.getByTestId('local-db-banner')).toHaveCount(0);
  });

  test('developer settings are only rendered in developer mode', async ({ page }) => {
    await login(page, E2E_ADMIN);
    await setDeveloperMode(page, false);
    await page.goto(admin('/settings?tab=brand'));
    await expect(page.locator('form[aria-label="Brand"][data-hydrated]')).toBeVisible();
    await expect(page.getByText('Developer settings')).toHaveCount(0);
    await expect(page.getByText('Browser theme color')).toHaveCount(0);
    await setDeveloperMode(page, true);
    await page.goto(admin('/settings?tab=brand'));
    await expect(page.getByRole('region', { name: 'Developer settings' })).toBeVisible();
    await expect(page.getByText('Browser theme color')).toBeVisible();
    await setDeveloperMode(page, false);
  });

  test('breadcrumbs show page labels, not ids', async ({ page }) => {
    await login(page, E2E_ADMIN);
    await page.goto(admin('/pages/home'));
    const crumbs = page.getByRole('navigation', { name: 'breadcrumb' });
    await expect(crumbs).toContainText('Pages');
    await expect(crumbs.locator('[data-slot="breadcrumb-page"]')).toHaveText('Home');
  });

  test('admin sees every section in the sidebar', async ({ page }) => {
    await login(page, E2E_ADMIN);
    const nav = sidebar(page);
    for (const label of ['Overview', 'Pages', 'Managers', 'Settings', 'Security', 'Sign out']) {
      await expect(
        nav.getByRole('link', { name: label }).or(nav.getByRole('button', { name: label })),
      ).toBeVisible();
    }
  });

  test('manager sees only Overview and Pages and cannot open admin-only screens', async ({
    page,
  }) => {
    await login(page, E2E_MANAGER);
    const nav = sidebar(page);
    await expect(nav.getByRole('link', { name: 'Overview' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Pages' })).toBeVisible();
    for (const label of ['Managers', 'Settings', 'Security']) {
      await expect(nav.getByRole('link', { name: label })).toHaveCount(0);
    }
    for (const path of [admin('/settings'), admin('/managers'), admin('/security')]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    }
  });

  test('sign out ends the session', async ({ page }) => {
    await login(page, E2E_ADMIN);
    await sidebar(page).getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(adminRe(String.raw`\/login`));
    await page.goto(admin());
    await expect(page).toHaveURL(adminRe(String.raw`\/login`));
  });
});

test('admin and site never share stylesheets', async ({ page }) => {
  await page.goto(admin('/login'));
  const adminCss = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
  await page.goto('/');
  const siteCss = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
  expect(siteCss.filter((href) => adminCss.includes(href))).toEqual([]);
});
