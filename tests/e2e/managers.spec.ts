import { expect, type Page, test } from '@playwright/test';

import { setDeveloperMode } from './support/developer';
import { login } from './support/auth';
import { E2E_ADMIN } from './support/users';

const RAW_USER_TARGET = /user:[0-9a-f]{8}-/;

const usersTable = (page: Page) => page.getByRole('table', { name: 'Users' });
const rowFor = (page: Page, email: string) =>
  usersTable(page).getByRole('row').filter({ hasText: email });

async function openManagers(page: Page) {
  await page.goto('/admin/managers');
  await expect(page.getByRole('heading', { name: 'Managers', level: 1 })).toBeVisible();
  await expect(usersTable(page)).toBeVisible();
}

async function rowAction(page: Page, email: string, action: string) {
  await rowFor(page, email)
    .getByRole('button', { name: `Actions for ${email}` })
    .click();
  await page.getByRole('menuitem', { name: action }).click();
}

test.describe.serial('managers', () => {
  const email = `new-manager-${Date.now()}@example.test`;
  let temporaryPassword = '';

  test('admin adds a manager and sees the temporary password once', async ({ page }) => {
    await login(page, E2E_ADMIN);
    await openManagers(page);
    await page.getByRole('button', { name: 'Add user' }).click();
    const form = page.getByRole('form', { name: 'Add user' });
    await form.getByLabel('Name').fill('New Manager');
    await form.getByLabel('Email').fill(email);
    await form.getByRole('button', { name: 'Create user' }).click();
    temporaryPassword = (await page.getByTestId('temporary-password').inputValue()).trim();
    expect(temporaryPassword.length).toBeGreaterThanOrEqual(12);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(rowFor(page, email)).toContainText('Manager');
  });

  test('the new user must change the temporary password at first sign-in', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(temporaryPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/admin\/change-password/);
    await page.getByLabel('Current password').fill(temporaryPassword);
    await page.getByLabel('New password', { exact: true }).fill('Copper-Meadow-Lantern-58');
    await page.getByLabel('Repeat new password').fill('Copper-Meadow-Lantern-58');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await context.close();
  });

  test('guards: a user cannot disable or delete themselves; the last admin cannot be demoted', async ({
    page,
  }) => {
    await login(page, E2E_ADMIN);
    await openManagers(page);

    await rowAction(page, E2E_ADMIN.email, 'Disable');
    await expect(page.getByText('You cannot disable your own account.')).toBeVisible();

    await rowAction(page, E2E_ADMIN.email, 'Delete');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('You cannot delete your own account.')).toBeVisible();

    await rowAction(page, E2E_ADMIN.email, 'Edit name & role');
    const form = page.getByRole('form', { name: 'Edit user' });
    await form.getByLabel('Role').click();
    await page.getByRole('option', { name: 'Manager' }).click();
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(
      page.getByText(/You cannot remove your own admin role|last active admin/),
    ).toBeVisible();
  });

  test('admin can disable a user, which blocks their sign-in', async ({ page, browser }) => {
    await login(page, E2E_ADMIN);
    await openManagers(page);
    await rowAction(page, email, 'Disable');
    await expect(page.getByText('User disabled and signed out.')).toBeVisible();
    await expect(rowFor(page, email)).toContainText('Disabled');

    const context = await browser.newContext();
    const other = await context.newPage();
    await other.goto('/admin/login');
    await other.getByLabel('Email').fill(email);
    await other.getByLabel('Password').fill('Copper-Meadow-Lantern-58');
    await other.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      other.getByRole('alert').filter({ hasText: 'Invalid email or password.' }),
    ).toBeVisible();
    await context.close();

    await rowAction(page, email, 'Delete');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('User deleted.')).toBeVisible();
    await expect(rowFor(page, email)).toHaveCount(0);
  });

  test('Security shows status, signed-in devices and activity; the full log filters', async ({
    page,
  }) => {
    await login(page, E2E_ADMIN);
    await setDeveloperMode(page, false);
    await page.goto('/admin/security');
    await expect(page.getByRole('region', { name: 'Status' })).toContainText('Everything works');
    await expect(page.getByRole('table', { name: 'Signed-in devices' })).toContainText(
      E2E_ADMIN.email,
    );
    // Technical details and the env table are not shown to clients.
    await expect(page.getByRole('region', { name: 'Developer settings' })).toHaveCount(0);
    await expect(page.getByText('AUTH_SECRET')).toHaveCount(0);
    const recent = page.getByRole('list', { name: 'Recent activity' });
    await expect(recent).toContainText('signed in');
    expect(await recent.textContent()).not.toMatch(RAW_USER_TARGET);

    await page.getByRole('link', { name: 'Show all activity' }).click();
    await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible();
    const log = page.getByRole('table', { name: 'Activity' });
    await expect(log).toContainText('Deleted a user');
    await page.getByRole('combobox', { name: 'Event type' }).selectOption('auth');
    await page.getByRole('button', { name: 'Filter' }).click();
    await expect(log).toContainText('Signed in');
    await expect(log).not.toContainText('Deleted a user');
    // Targets show names, not raw ids.
    expect(await log.textContent()).not.toMatch(RAW_USER_TARGET);
    await page.goto('/admin');
    await expect(page.getByRole('link', { name: 'Recent activity' })).toBeVisible();
    expect(await page.locator('main').textContent()).not.toMatch(RAW_USER_TARGET);
  });
});
