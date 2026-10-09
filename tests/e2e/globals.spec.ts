import { expect, type Page, test } from '@playwright/test';

import { login } from './support/auth';
import { E2E_MANAGER } from './support/users';

const VISITOR = { 'user-agent': 'Mozilla/5.0 Chrome/150', 'accept-language': 'en' };

async function html(page: Page, path: string): Promise<string> {
  const response = await page.context().request.fetch(path, { headers: VISITOR });
  expect(response.status()).toBe(200);
  return response.text();
}

/** Header and footer of every demo page in both locales. */
const PAGES = ['/', '/about', '/blog', '/contact', '/uk', '/uk/about/team', '/uk/blog/hello-world'];

test('editing the phone in Site-wide updates the header and footer of every page', async ({
  page,
}) => {
  const phone = `+380 44 ${String(Date.now()).slice(-3)} 00 00`;
  const aboutBefore = /<h1[^>]*>([^<]*)/.exec(await html(page, '/about'))?.[1];

  await login(page, E2E_MANAGER);
  await page.goto('/admin/pages/site-wide/site');
  await expect(page.locator('form[data-hydrated]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Header & footer', level: 1 })).toBeVisible();
  // Site-wide content has no SEO tab.
  await expect(page.getByRole('tab', { name: 'SEO' })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Phone' }).fill(phone);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/^Saved\./)).toBeVisible();

  for (const path of PAGES) {
    await expect
      .poll(async () => (await html(page, path)).split(phone).length - 1, { message: path })
      .toBeGreaterThanOrEqual(2); // header + footer
  }
  // Other content is untouched.
  expect(/<h1[^>]*>([^<]*)/.exec(await html(page, '/about'))?.[1]).toBe(aboutBefore);
});

test('invalid phone numbers are rejected in the editor', async ({ page }) => {
  await login(page, E2E_MANAGER);
  await page.goto('/admin/pages/site-wide/site');
  await expect(page.locator('form[data-hydrated]')).toBeVisible();
  await page.getByRole('textbox', { name: 'Phone' }).fill('call us');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/Enter a phone number/)).toBeVisible();
});
