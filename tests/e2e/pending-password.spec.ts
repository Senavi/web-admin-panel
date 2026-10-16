import { type Page } from '@playwright/test';

import { admin, adminRe } from './support/admin';
import { login } from './support/auth';
import { expect, test } from './support/test';
import { E2E_ADMIN } from './support/users';

const NEW_PASSWORD = 'Copper-Meadow-Lantern-59';

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(admin('/login'));
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** A manager with a temporary password must not get stuck on "Choose a new password". */
test('someone with a temporary password can leave the change-password screen and sign in again', async ({
  browser,
  page,
}) => {
  const email = `pending-${Date.now()}@example.test`;
  await login(page, E2E_ADMIN);
  await page.goto(admin('/managers'));
  await page.getByRole('button', { name: 'Add person' }).click();
  const form = page.getByRole('form', { name: 'Add person' });
  await form.getByLabel('Name').fill('Pending Person');
  await form.getByLabel('Email').fill(email);
  await form.getByRole('button', { name: 'Add', exact: true }).click();
  const temporary = (await page.getByTestId('temporary-password').inputValue()).trim();
  await page.getByRole('button', { name: 'Done' }).click();

  const context = await browser.newContext();
  const person = await context.newPage();
  await signIn(person, email, temporary);
  await expect(person).toHaveURL(adminRe(String.raw`\/change-password`));
  await expect(person.getByText(email)).toBeVisible();

  // Opening the login page again shows a notice instead of looping to change-password.
  await person.goto(admin('/login'));
  await expect(person).toHaveURL(adminRe(String.raw`\/login`));
  await expect(person.getByText(`You’re signed in as ${email}`)).toBeVisible();
  await expect(person.getByRole('button', { name: 'Continue' })).toHaveAttribute(
    'href',
    admin('/change-password'),
  );
  await person.getByRole('button', { name: 'Use another account' }).click();
  await expect(person).toHaveURL(adminRe(String.raw`\/login`));
  await expect(person.getByText('You’re signed in as')).toHaveCount(0);
  // Signed out: the admin sends them to login.
  await person.goto(admin('/change-password'));
  await expect(person).toHaveURL(adminRe(String.raw`\/login`));

  // The temporary password still works, and "Sign out and go back" works too.
  await signIn(person, email, temporary);
  await expect(person).toHaveURL(adminRe(String.raw`\/change-password`));
  await person.getByRole('button', { name: 'Sign out and go back to sign in' }).click();
  await expect(person).toHaveURL(adminRe(String.raw`\/login`));
  await expect(person.getByText('You’re signed in as')).toHaveCount(0);

  // Choosing the password gives a normal session.
  await signIn(person, email, temporary);
  await person.getByLabel('Current password').fill(temporary);
  await person.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await person.getByLabel('Repeat new password').fill(NEW_PASSWORD);
  await person.getByRole('button', { name: 'Change password' }).click();
  await expect(person).toHaveURL(adminRe(String.raw`$`));
  await expect(person.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
  // Fully signed in: the login page redirects as before.
  await person.goto(admin('/login'));
  await expect(person).toHaveURL(adminRe(String.raw`$`));
  await context.close();
});
