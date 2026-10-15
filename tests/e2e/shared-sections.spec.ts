import { type Page } from '@playwright/test';

import { admin } from './support/admin';
import { login } from './support/auth';
import { expect, test } from './support/test';
import { E2E_ADMIN } from './support/users';

/** The demo CTA band is a shared section on Home and About (src/content/shared/cta.ts). */
const CTA_TITLE = '#field-content-cta-title';
const saveButton = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });

async function openEditor(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('form[data-hydrated]')).toBeVisible();
}

/** Opens the shared "Call to action" section (sections start collapsed except the first). */
async function openCta(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: /^Call to action/ });
  if ((await page.locator(CTA_TITLE).count()) === 0) await trigger.click();
  await expect(page.locator(CTA_TITLE)).toBeVisible();
}

async function liveHtml(page: Page, path: string): Promise<string> {
  const response = await page.request.get(path, {
    headers: { 'user-agent': 'Mozilla/5.0 Chrome/150', 'accept-language': 'en' },
  });
  return response.text();
}

test.describe.serial('shared sections', () => {
  test('a shared section shows in place on every page; editing it from Home updates About', async ({
    page,
  }) => {
    await login(page, E2E_ADMIN);
    await openEditor(page, admin('/pages/home'));
    // All of Home's sections, in site order, with the shared one in place.
    const headings = page.locator('form h2');
    await expect(headings).toContainText(['Hero', 'Features', 'Numbers', 'Call to action']);
    await openCta(page);
    const cta = page
      .locator('[data-slot="collapsible"]')
      .filter({ has: page.locator(CTA_TITLE) })
      .first();
    await expect(cta.getByText('Shared', { exact: true })).toBeVisible();
    await expect(cta).toContainText('Also on: About. Changes here update all 2 pages.');
    await expect(cta.getByRole('link', { name: 'About' })).toHaveAttribute(
      'href',
      admin('/pages/about'),
    );

    const title = `Shared CTA ${Date.now()}`;
    await page.locator(CTA_TITLE).fill(title);
    await saveButton(page).click();
    await expect(page.getByText('Saved. The live site updates in a few seconds.')).toBeVisible();

    await openEditor(page, admin('/pages/about'));
    await openCta(page);
    await expect(page.locator(CTA_TITLE)).toHaveValue(title);
    await expect.poll(async () => liveHtml(page, '/about')).toContain(title);
    expect(await liveHtml(page, '/')).toContain(title);

    // "Every page" lists it for an overview.
    const everyPage = page.getByRole('region', { name: 'Every page' });
    await expect(everyPage.getByRole('link', { name: /Call to action/ })).toContainText(
      'Used on 2 pages',
    );
  });

  test('editing the same shared section on two pages at once is a conflict naming it', async ({
    browser,
  }) => {
    const home = await browser.newPage();
    const about = await browser.newPage();
    await login(home, E2E_ADMIN);
    await login(about, E2E_ADMIN);
    await openEditor(home, admin('/pages/home'));
    await openEditor(about, admin('/pages/about'));
    await openCta(home);
    await openCta(about);

    await home.locator(CTA_TITLE).fill(`From Home ${Date.now()}`);
    await saveButton(home).click();
    await expect(home.getByText('Saved. The live site updates in a few seconds.')).toBeVisible();

    await about.locator(CTA_TITLE).fill(`From About ${Date.now()}`);
    await saveButton(about).click();
    await expect(about.getByText('This was changed by someone else')).toBeVisible();
    await expect(
      about.getByRole('alert').filter({ hasText: 'This was changed by someone else' }),
    ).toContainText('shared section “Call to action”');
    await home.close();
    await about.close();
  });
});
