import fs from 'node:fs/promises';
import path from 'node:path';

import { admin } from '../e2e/support/admin';
import { login } from '../e2e/support/auth';
import { E2E_DATA_DIR, E2E_STAGING_MAIL_TO } from '../e2e/support/env';
import { DEMO_PRESENT, SAMPLE_PATH } from '../e2e/support/site';
import { GA_ID, setGoogleAnalytics, submitContact, visitor } from '../e2e/support/integrations';
import { openSettingsTab, saveSettingsTab, VISITOR_HEADERS } from '../e2e/support/settings';
import { expect, test } from '../e2e/support/test';
import { E2E_ADMIN, E2E_MANAGER } from '../e2e/support/users';

const MAIL_DIR = path.join(E2E_DATA_DIR, 'mail');
const CLIENT = 'client-owner@example.test';

/**
 * A staging deploy (DEPLOYMENT_ENVIRONMENT=staging): its database is often a copy of
 * production, so it must never act like the live site (D-097).
 */
test.describe.serial('staging safety', () => {
  test('a staging site on the live database shows the red warning instead of the staging bar', async ({
    page,
  }) => {
    // The fixture marks this database production (scripts/e2e-prod.ts, CI): D-099.
    await login(page, E2E_ADMIN);
    for (const path of [admin(), admin('/pages'), admin('/settings')]) {
      await page.goto(path);
      await expect(page.getByTestId('database-mismatch-bar')).toHaveText(
        'This staging site is connected to the LIVE database. Changes here change the live site. Fix DATABASE_URL for the staging branch.',
      );
      await expect(page.getByTestId('environment-bar')).toHaveCount(0);
    }
    await expect(page.getByTestId('database-mismatch-bar')).toBeVisible();
    await page.goto(admin());
    await expect(page.getByTestId('database-mismatch-warning')).toBeVisible();
    await page.goto(admin('/security'));
    await expect(
      page.getByRole('region', { name: 'Status' }).getByText('connected to the LIVE database'),
    ).toBeVisible();
  });

  test('managers see the warning too', async ({ page }) => {
    await login(page, E2E_MANAGER);
    await page.goto(admin());
    await expect(page.getByTestId('database-mismatch-bar')).toBeVisible();
  });

  test('the admin says staging is hidden from Google, whatever the stored setting', async ({
    page,
  }) => {
    await login(page, E2E_ADMIN);
    await page.goto(admin());
    await expect(page.getByText('Hidden from Google (staging)').first()).toBeVisible();
    await expect(page.getByText('Visible in Google')).toHaveCount(0);
    const form = await openSettingsTab(page, 'search', 'Google & sharing');
    await expect(page.getByTestId('staging-indexing-note')).toBeVisible();
    await expect(form.getByLabel('Show the site in Google')).toHaveCount(0);
  });

  test('never indexed: robots disallow, empty sitemap, noindex header', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toMatch(/Disallow: \/\s*$/m);
    expect(robots).not.toContain('Sitemap:');
    expect(await (await request.get('/sitemap.xml')).text()).not.toContain('<loc>');
    const home = await request.get('/', { headers: VISITOR_HEADERS });
    expect(home.headers()['x-robots-tag']).toContain('noindex');
  });

  test('no tracking script, even with Google Analytics on and cookies accepted', async ({
    page,
    browser,
  }) => {
    await login(page, E2E_ADMIN);
    await setGoogleAnalytics(page, true);
    try {
      const csp = (await page.request.get('/', { headers: VISITOR_HEADERS })).headers()[
        'content-security-policy'
      ];
      expect(csp).not.toContain('googletagmanager');

      const guest = await visitor(browser);
      const loaded: string[] = [];
      await guest.context.route('https://www.googletagmanager.com/**', (route) => {
        loaded.push(route.request().url());
        return route.fulfill({ contentType: 'text/javascript', body: '' });
      });
      // A visitor who accepted cookies earlier (e.g. on a copy of production data).
      await guest.context.addCookies([
        { name: 'cookie-consent', value: 'accepted', url: page.url() },
      ]);
      await guest.page.goto('/');
      await expect(guest.page.getByRole('region', { name: 'Cookies' })).toHaveCount(0);
      await guest.page.goto(SAMPLE_PATH);
      await guest.page.waitForTimeout(2000);
      expect(loaded.filter((url) => url.includes(GA_ID))).toEqual([]);
      await guest.context.close();
    } finally {
      await setGoogleAnalytics(page, false);
    }
  });

  test('form emails go to the team only, never to the client’s recipients', async ({
    page,
    browser,
  }) => {
    test.skip(!DEMO_PRESENT, 'Submits the demo contact form.');
    await login(page, E2E_ADMIN);
    const form = await openSettingsTab(page, 'requests', 'Requests');
    await expect(page.getByTestId('staging-mail-note')).toContainText(
      `Staging: emails go to ${E2E_STAGING_MAIL_TO} only`,
    );
    await form.getByLabel('Default recipients').fill(CLIENT);
    await saveSettingsTab(page);

    const name = `Staging request ${Date.now()}`;
    const guest = await visitor(browser);
    await submitContact(guest.page, name);
    await guest.context.close();

    const mail = async () => {
      const files = await fs.readdir(MAIL_DIR).catch(() => [] as string[]);
      const texts = await Promise.all(
        files.map((file) => fs.readFile(path.join(MAIL_DIR, file), 'utf8')),
      );
      return texts.find((text) => text.includes(name)) ?? '';
    };
    await expect.poll(mail).toContain(`To: ${E2E_STAGING_MAIL_TO}`);
    expect(await mail()).not.toContain(CLIENT);
    await page.goto(admin('/pages/forms/contact?status=all'));
    await expect(page.getByRole('table', { name: 'Requests' })).toContainText(name);
  });
});
