import { type Page } from '@playwright/test';

import { admin } from '../support/admin';
import { login } from '../support/auth';
import { expect, test } from '../support/test';
import { E2E_ADMIN } from '../support/users';

const BUTTON_LABEL = 'Button on blog cards';

async function openInterfaceTexts(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('form[data-hydrated]')).toBeVisible();
  const panel = page.getByTestId('interface-texts');
  await panel.getByRole('button', { name: /^Interface texts/ }).click();
  await expect(panel.getByLabel(BUTTON_LABEL)).toBeVisible();
}

async function liveHtml(page: Page, path: string): Promise<string> {
  const response = await page.request.get(path, {
    headers: { 'user-agent': 'Mozilla/5.0 Chrome/150', 'accept-language': 'en' },
  });
  return response.text();
}

test.describe.serial('interface texts', () => {
  const text = `Learn more ${Date.now()}`;

  test('a text edited on Blog changes the Home teasers too, and Reset brings the default back', async ({
    page,
  }) => {
    await login(page, E2E_ADMIN);
    await openInterfaceTexts(page, admin('/pages/blog'));
    const panel = page.getByTestId('interface-texts');
    await expect(panel).toContainText('Also on: Home');
    await panel.getByLabel(BUTTON_LABEL).fill(text);
    await panel.getByRole('button', { name: 'Save blog texts' }).click();
    await expect(page.getByText('Saved. The live site updates in a few seconds.')).toBeVisible();

    await expect.poll(async () => liveHtml(page, '/')).toContain(text);
    await expect.poll(async () => liveHtml(page, '/blog')).toContain(text);

    // Another language is untouched.
    expect(await liveHtml(page, '/uk')).not.toContain(text);

    // The same group is editable from Home and shows the edit.
    await openInterfaceTexts(page, admin('/pages/home'));
    await expect(page.getByTestId('interface-texts').getByLabel(BUTTON_LABEL)).toHaveValue(text);

    await page
      .getByTestId('interface-texts')
      .getByRole('button', { name: 'Reset' })
      .first()
      .click();
    await page
      .getByTestId('interface-texts')
      .getByRole('button', { name: 'Save blog texts' })
      .click();
    await expect(page.getByText('Saved. The live site updates in a few seconds.')).toBeVisible();
    await expect.poll(async () => liveHtml(page, '/')).not.toContain(text);
  });

  test('every interface text is listed on one page', async ({ page }) => {
    await login(page, E2E_ADMIN);
    await page.goto(admin('/pages/interface-texts'));
    await expect(page.getByRole('heading', { name: 'Interface texts' })).toBeVisible();
    for (const group of ['General', 'Menu', 'Footer', 'Blog', 'Forms']) {
      await expect(page.getByRole('heading', { name: group, exact: true, level: 3 })).toBeVisible();
    }
    await expect(page.getByLabel('Menu link: Blog')).toHaveValue('Blog');
  });

  test('a placeholder cannot be removed from a text', async ({ page }) => {
    await login(page, E2E_ADMIN);
    await openInterfaceTexts(page, admin('/pages/blog'));
    const panel = page.getByTestId('interface-texts');
    await panel.getByLabel('Date line of a post ({date} is the date)').fill('Published');
    await panel.getByRole('button', { name: 'Save blog texts' }).click();
    await expect(panel.getByRole('alert')).toContainText('{date}');
  });
});
