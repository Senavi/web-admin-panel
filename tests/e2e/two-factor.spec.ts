import { expect, test } from '@playwright/test';

import { login } from './support/auth';
import { totp } from './support/totp';
import { E2E_MANAGER } from './support/users';

test('user can enable TOTP 2FA and must use it to sign in', async ({ page, context }) => {
  await login(page, E2E_MANAGER);
  await page.goto('/admin/account');

  await page.getByLabel('Confirm with your password to set it up').fill(E2E_MANAGER.password);
  await page.getByRole('button', { name: 'Set up two-factor authentication' }).click();
  const secret = (await page.getByTestId('totp-secret').textContent())?.trim() ?? '';
  expect(secret).not.toBe('');

  await page.getByLabel('3. Enter the 6-digit code from the app').fill(totp(secret));
  await page.getByRole('button', { name: 'Turn on' }).click();
  await expect(
    page.getByText('Sign-in requires a code from your authenticator app.'),
  ).toBeVisible();

  // Fresh sign-in now requires the second factor.
  await context.clearCookies();
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(E2E_MANAGER.email);
  await page.getByLabel('Password').fill(E2E_MANAGER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Authentication code')).toBeVisible();

  const codeInput = page.getByLabel('Authentication code');
  await codeInput.fill('000000');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText('Invalid verification code.').first()).toBeVisible();

  await codeInput.fill('');
  await codeInput.fill(totp(secret));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // Turn it off again so other tests can sign in with a password only.
  await page.goto('/admin/account');
  await page.getByLabel('Confirm with your password to turn it off').fill(E2E_MANAGER.password);
  await page.getByRole('button', { name: 'Turn off two-factor authentication' }).click();
  await expect(page.getByText('Set up two-factor authentication')).toBeVisible();
});
