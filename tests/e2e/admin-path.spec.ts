import { expect, test } from './support/test';

import { admin, ADMIN, adminRe } from './support/admin';
import { login } from './support/auth';
import { setDeveloperMode } from './support/developer';
import { E2E_ADMIN } from './support/users';

/** The admin lives at a custom path (`projectConfig.adminPath`); the internal `/admin` is hidden. */
test.describe('custom admin path', () => {
  test.skip(ADMIN === '/admin', 'needs a custom adminPath in project.config.ts');

  test('login, navigation and server actions work under the custom path', async ({ page }) => {
    const response = await page.goto(admin('/login'));
    expect(response?.status()).toBe(200);
    expect(response?.headers()['cache-control']).toContain('no-store');
    expect(response?.headers()['x-robots-tag']).toContain('noindex');
    expect(response?.headers()['content-security-policy']).toMatch(/nonce-/);

    await login(page, E2E_ADMIN);
    await expect(page).toHaveURL(adminRe('$'));
    const nav = page
      .getByRole('navigation', { name: 'Admin navigation' })
      .or(page.locator('[data-sidebar="sidebar"]'));
    await nav.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(adminRe(String.raw`\/settings`));
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await nav.getByRole('link', { name: 'Pages' }).click();
    await expect(page).toHaveURL(adminRe(String.raw`\/pages$`));

    // A server action (developer mode switch) posts to the custom path.
    await setDeveloperMode(page, true);
    await setDeveloperMode(page, false);
    await expect(page).toHaveURL(adminRe(String.raw`\/account`));
  });

  test('the internal /admin path answers the site 404', async ({ request }) => {
    for (const path of ['/admin', '/admin/login', '/admin/settings', '/admin/pages/home']) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
      expect(await response.text(), path).not.toContain(ADMIN);
    }
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).not.toContain(ADMIN);
  });
});
