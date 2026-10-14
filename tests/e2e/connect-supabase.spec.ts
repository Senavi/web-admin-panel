import { login } from './support/auth';
import { setDeveloperMode } from './support/developer';
import { admin } from './support/admin';
import { expect, test } from './support/test';
import { E2E_ADMIN } from './support/users';

const REF = 'abcdefghijklmnopqrst';
const SHARED = `postgresql://postgres.${REF}:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
const DIRECT = `postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres`;

/** Connect Supabase exists only in development (`pnpm dev`, the default `pnpm e2e` server). */
test.describe('Connect Supabase guide', () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'development only');

  test('one connection string, detected type and an IPv4 / IPv6 badge', async ({ page }) => {
    await login(page, E2E_ADMIN);
    await setDeveloperMode(page, true);
    await page.goto(admin('/security'));
    // The local-database banner links here too; open the guide from Developer settings.
    await page
      .getByRole('region', { name: 'Developer settings' })
      .getByRole('button', { name: 'Connect Supabase' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Connect Supabase' });
    await dialog.getByRole('button', { name: 'I have created the project' }).click();

    // Only one connection string field (no separate direct URL or project URL).
    await expect(dialog.getByLabel('Connection string')).toHaveCount(1);
    await expect(dialog.getByLabel('Project URL')).toHaveCount(0);
    await expect(dialog.getByLabel('Direct connection string')).toHaveCount(0);
    await expect(dialog).toContainText('Shared pooler → Transaction pooler');

    const field = dialog.getByLabel('Connection string');
    const type = dialog.getByRole('status', { name: 'Connection type' });
    await field.fill(DIRECT);
    await expect(type).toContainText('Direct connection');
    await expect(type).toContainText('IPv6 only');
    await expect(type).toContainText('pooler.supabase.com:6543');
    await field.fill(SHARED);
    await expect(type).toContainText('Shared pooler, transaction mode');
    await expect(type).toContainText('IPv4 ✓');

    await page.keyboard.press('Escape');
    await setDeveloperMode(page, false);
  });
});
