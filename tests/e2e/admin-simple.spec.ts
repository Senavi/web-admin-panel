import { expect, test } from '@playwright/test';

import { login } from './support/auth';
import { setDeveloperMode } from './support/developer';
import { E2E_ADMIN, E2E_MANAGER } from './support/users';

test.describe('simpler admin', () => {
  test('Pages sidebar groups and the Google & sharing tab', async ({ page }) => {
    await login(page, E2E_MANAGER);
    await page.goto('/admin/pages/about');
    const pagesNav = page.getByRole('navigation', { name: 'Pages' });
    for (const group of ['Blog & lists', 'Every page', 'Forms']) {
      await expect(pagesNav.getByRole('region', { name: group })).toBeVisible();
    }
    await expect(page.locator('form[data-hydrated]')).toBeVisible();
    // The editor follows the accordion rule: first section open, the others closed.
    await expect(page.getByRole('button', { name: 'Expand all' })).toBeVisible();

    await page.getByRole('tab', { name: 'Google & sharing' }).click();
    await expect(page.getByLabel('Google preview')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Title in Google' })).toBeVisible();
    // Rarely needed options start closed.
    await expect(page.getByRole('switch', { name: 'Hide this page from Google' })).toHaveCount(0);
    await page.getByRole('button', { name: /Advanced/ }).click();
    await expect(page.getByRole('switch', { name: 'Hide this page from Google' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Main address of this content' })).toBeVisible();
  });

  test('Overview: three KPIs, more statistics closed, one status line', async ({ page }) => {
    await login(page, E2E_ADMIN);
    await page.goto('/admin');
    const kpis = page.getByRole('region', { name: 'Key metrics' });
    await expect(kpis.getByRole('heading', { name: 'Visitors' })).toBeVisible();
    await expect(kpis.getByRole('heading', { name: 'Page views' })).toBeVisible();
    await expect(kpis.getByRole('heading', { name: 'New requests' })).toBeVisible();
    await expect(kpis.getByRole('link', { name: 'Open the inbox' })).toHaveAttribute(
      'href',
      /\/admin\/pages\/forms\//,
    );
    await expect(page.getByRole('heading', { name: 'Browsers' })).toHaveCount(0);
    await page.getByRole('button', { name: /More statistics/ }).click();
    await expect(page.getByRole('heading', { name: 'Browsers' })).toBeVisible();
    await expect(page.getByLabel('Site status')).toContainText(/The site is (live|paused|private)/);
  });

  test('Security: technical cards only in developer mode, no Connect Supabase in production', async ({
    page,
  }) => {
    await login(page, E2E_ADMIN);
    await setDeveloperMode(page, true);
    await page.goto('/admin/security');
    const developer = page.getByRole('region', { name: 'Developer settings' });
    await expect(developer).toContainText('Database');
    await expect(developer).toContainText('File storage');
    // Connect Supabase is a development-only tool.
    await expect(page.getByRole('button', { name: 'Connect Supabase' })).toHaveCount(0);
    await setDeveloperMode(page, false);
    await page.goto('/admin/security');
    await expect(page.getByRole('region', { name: 'Developer settings' })).toHaveCount(0);
  });
});
