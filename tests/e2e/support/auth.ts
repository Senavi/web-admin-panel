import { expect, type Page } from '@playwright/test';
import { admin, adminRe } from './admin';

export async function login(page: Page, user: { email: string; password: string }): Promise<void> {
  await page.goto(admin('/login'));
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(adminRe(String.raw`\/login`));
}
