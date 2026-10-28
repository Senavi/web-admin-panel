import { request } from '@playwright/test';

import { admin } from './support/admin';
import { login } from './support/auth';
import { openSettingsTab, saveSettingsTab, VISITOR_HEADERS } from './support/settings';
import { expect, test } from './support/test';
import { E2E_ADMIN } from './support/users';
import {
  FIRST_PAGE_ID,
  localePath,
  OTHER_LOCALE,
  OTHER_LOCALE_LABEL,
  SAMPLE_PATH,
} from './support/site';

const GERMAN = 'li[data-language="de"]';

test.describe.serial('languages added by the admin', () => {
  test.afterAll(async ({ browser, baseURL }) => {
    // Leave the project's languages as they were, whatever happened above.
    const page = await browser.newPage({ baseURL });
    await login(page, E2E_ADMIN);
    const form = await openSettingsTab(page, 'general', 'General');
    const row = form.locator(GERMAN);
    if ((await row.count()) > 0) {
      await row.getByRole('button', { name: 'Remove' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click();
      await saveSettingsTab(page);
    }
    await page.close();
  });

  test('a new language starts as a draft: hidden on the site, editable in the admin', async ({
    page,
    baseURL,
  }) => {
    await login(page, E2E_ADMIN);
    const form = await openSettingsTab(page, 'general', 'General');
    await form.getByLabel('Add a language').fill('german');
    await form.getByRole('list', { name: 'Languages found' }).getByRole('button').first().click();
    const row = form.locator(GERMAN);
    await expect(row).toHaveAttribute('data-state', 'draft');
    await saveSettingsTab(page);

    const visitor = await request.newContext({ baseURL, extraHTTPHeaders: VISITOR_HEADERS });
    await expect
      .poll(async () => (await visitor.get('/de', { maxRedirects: 0 })).status(), {
        timeout: 15_000,
      })
      .toBe(404);
    expect((await visitor.get('/sitemap.xml')).status()).toBe(200);
    expect(await (await visitor.get('/sitemap.xml')).text()).not.toContain('/de');
    // Existing languages are untouched.
    expect((await visitor.get(SAMPLE_PATH)).status()).toBe(200);
    if (OTHER_LOCALE)
      expect((await visitor.get(localePath(OTHER_LOCALE, SAMPLE_PATH))).status()).toBe(200);
    await visitor.dispose();

    await page.goto(admin(`/pages/${FIRST_PAGE_ID}?locale=de`));
    await expect(page.locator('form[data-hydrated]')).toBeVisible();
    await expect(page).toHaveURL(/locale=de/);
  });

  test('publishing makes it appear in the switcher and the sitemap', async ({ page, baseURL }) => {
    await login(page, E2E_ADMIN);
    const form = await openSettingsTab(page, 'general', 'General');
    await form.locator(GERMAN).getByRole('button', { name: 'Publish language' }).click();
    await expect(form.locator(GERMAN)).toHaveAttribute('data-state', 'published');
    await saveSettingsTab(page);

    const visitor = await request.newContext({ baseURL, extraHTTPHeaders: VISITOR_HEADERS });
    await expect
      .poll(async () => (await visitor.get('/de', { maxRedirects: 0 })).status(), {
        timeout: 15_000,
      })
      .toBe(200);
    await expect
      .poll(async () => (await (await visitor.get('/sitemap.xml')).text()).includes('/de'))
      .toBe(true);
    await visitor.dispose();

    await page.goto(SAMPLE_PATH);
    await page
      .getByRole('button', { name: /^Language:/ })
      .first()
      .click();
    const list = page.getByRole('list', { name: 'Language' }).first();
    await expect(list.getByRole('link', { name: 'Deutsch' })).toBeVisible();
    if (OTHER_LOCALE_LABEL)
      await expect(list.getByRole('link', { name: OTHER_LOCALE_LABEL })).toBeVisible();
  });
});
