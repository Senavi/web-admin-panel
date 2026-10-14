import { expect, type Page } from '@playwright/test';
import { admin } from './admin';

/** Turns developer mode on or off for the signed-in user (Account page). */
export async function setDeveloperMode(page: Page, on: boolean): Promise<void> {
  await page.goto(admin('/account'));
  await page.getByRole('button', { name: 'Developer mode' }).click();
  const toggle = page.getByRole('switch', { name: 'Developer mode' });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-checked')) === String(on)) return;
  await toggle.click();
  await expect(
    page.getByText(on ? 'Developer mode is on.' : 'Developer mode is off.'),
  ).toBeVisible();
}
