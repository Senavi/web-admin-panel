import { expect, test } from '@playwright/test';

test('home page renders', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toBeVisible();
});

test('admin is not indexable', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
