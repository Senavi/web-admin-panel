import { expect, test } from '@playwright/test';

import { login } from './support/auth';
import { E2E_ADMIN } from './support/users';

test.describe('admin authentication', () => {
  test('redirects anonymous users to the login page', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('wrong password shows a generic error', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(E2E_ADMIN.email);
    await page.getByLabel('Password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Invalid email or password.' }),
    ).toBeVisible();
  });

  test('unknown email shows the same generic error', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('nobody@example.test');
    await page.getByLabel('Password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Invalid email or password.' }),
    ).toBeVisible();
  });

  test('repeated failures trigger rate limiting', async ({ page }) => {
    const email = 'locked-out@example.test';
    await page.goto('/admin/login');
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(`wrong-password-${attempt}`);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    }
    await expect(
      page.getByRole('alert').filter({ hasText: 'Too many failed attempts' }),
    ).toBeVisible();
  });

  test('admin can sign in and open Account', async ({ page }) => {
    await login(page, E2E_ADMIN);
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await page.goto('/admin/account');
    await expect(page.getByRole('heading', { name: 'Account', level: 1 })).toBeVisible();
    await expect(page.getByText('This device')).toBeVisible();
  });

  test('admin responses are not cached or indexed', async ({ page }) => {
    const response = await page.goto('/admin/login');
    expect(response?.headers()['cache-control']).toContain('no-store');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('Better Auth HTTP sign-in endpoint is not exposed', async ({ request }) => {
    const response = await request.post('/api/auth/sign-in/email', {
      data: { email: E2E_ADMIN.email, password: E2E_ADMIN.password },
    });
    expect(response.status()).toBe(404);
  });
});

test('login returns to the originally requested admin page', async ({ page }) => {
  await page.goto('/admin/account');
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Faccount/);
  await page.getByLabel('Email').fill(E2E_ADMIN.email);
  await page.getByLabel('Password').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/account$/);
});
