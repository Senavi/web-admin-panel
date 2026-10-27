import { type Browser, type Page } from '@playwright/test';

import { admin } from './admin';
import { VISITOR_HEADERS } from './settings';
import { expect } from './test';

/** Shared by the integrations and staging specs. */
export const GA_ID = 'G-E2ETEST123';
/** Signed timing token on site forms: humans need ≥ 3 s. */
export const FILL_DELAY_MS = 3200;

export async function openIntegrations(page: Page) {
  await page.goto(admin('/settings?tab=integrations'));
  await expect(page.getByRole('heading', { name: 'Email for forms' })).toBeVisible();
}

export async function setGoogleAnalytics(page: Page, on: boolean) {
  await openIntegrations(page);
  const card = page.getByRole('group', { name: 'Google Analytics 4' });
  const toggle = card.getByRole('switch');
  if ((await toggle.getAttribute('aria-checked')) !== String(on)) await toggle.click();
  if (on) await card.getByLabel('Measurement ID').fill(GA_ID);
  await card.getByRole('button', { name: 'Save Google Analytics 4' }).click();
  await expect(page.getByText('Google Analytics 4 saved.')).toBeVisible();
}

let ipCounter = 0;
export async function visitor(browser: Browser) {
  ipCounter += 1;
  const context = await browser.newContext({
    extraHTTPHeaders: {
      ...VISITOR_HEADERS,
      'x-forwarded-for': `198.51.100.${(Date.now() % 150) + ipCounter}`,
    },
  });
  return { context, page: await context.newPage() };
}

export async function submitContact(page: Page, name: string) {
  await page.goto('/contact');
  await expect(page.locator('form#form-contact input[name="_t"]')).toBeAttached();
  await page.locator('#contact-consent').check();
  await page.locator('#contact-name').fill(name);
  await page.locator('#contact-email').fill('visitor@example.test');
  await page.locator('#contact-message').fill('Hello from the integrations test.');
  await page.waitForTimeout(FILL_DELAY_MS);
  await page.locator('form#form-contact button[type="submit"]').click();
  await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
}
