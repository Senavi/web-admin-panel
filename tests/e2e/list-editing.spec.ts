import { type Page } from '@playwright/test';

import { admin } from './support/admin';
import { login } from './support/auth';
import { expect, test } from './support/test';
import { E2E_MANAGER } from './support/users';

async function openEditor(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('form[data-hydrated]')).toBeVisible();
  await page.getByRole('button', { name: 'Expand all' }).click();
}

/** Pastes text into the focused element (a synthetic paste event with clipboard data). */
async function paste(page: Page, selector: string, text: string): Promise<void> {
  await page.locator(selector).evaluate((element, value) => {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, text);
}

test.describe('list editing', () => {
  test('lines: all visible, Enter adds and focuses a line, Backspace removes an empty one, paste adds many', async ({
    page,
  }) => {
    await login(page, E2E_MANAGER);
    await openEditor(page, admin('/pages/home'));
    const lines = page.locator('[data-list-display="lines"]', { hasText: 'Highlights' });
    const inputs = lines.getByRole('textbox');
    await expect(inputs).toHaveCount(3);

    await inputs.nth(2).click();
    await inputs.nth(2).press('End');
    await inputs.nth(2).press('Enter');
    await expect(inputs).toHaveCount(4);
    await expect(inputs.nth(3)).toBeFocused();
    await page.keyboard.type('A fourth point');
    await expect(inputs.nth(3)).toHaveValue('A fourth point');

    await inputs.nth(3).fill('');
    await inputs.nth(3).press('Backspace');
    await expect(inputs).toHaveCount(3);
    await expect(inputs.nth(2)).toBeFocused();

    await inputs.nth(2).press('Enter');
    await paste(page, `[aria-label="Highlights 4"]`, 'Pasted one\nPasted two\nPasted three');
    await expect(inputs).toHaveCount(6);
    await expect(inputs.nth(3)).toHaveValue('Pasted one');
    await expect(inputs.nth(5)).toHaveValue('Pasted three');
    // max: 6 → no more lines.
    await expect(lines.getByRole('button', { name: 'Add' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(inputs).toHaveCount(3);
  });

  test('rows: every item visible as a row of short fields, no expanding', async ({ page }) => {
    await login(page, E2E_MANAGER);
    await openEditor(page, admin('/pages/home'));
    const rows = page.locator('[data-list-display="rows"]', { hasText: 'Numbers' });
    await expect(rows.getByRole('columnheader')).toContainText(['Value', 'Suffix', 'Label']);
    const before = await rows.locator('tbody tr').count();
    await rows.getByRole('button', { name: 'Add row' }).click();
    await expect(rows.locator('tbody tr')).toHaveCount(before + 1);
    await expect(rows.getByRole('textbox', { name: `Label ${before + 1}` })).toBeVisible();
    await page.getByRole('button', { name: 'Discard' }).click();
  });

  test('tags: Enter adds, paste adds many, Delete and × remove, keyboard moves; saved as plain values', async ({
    page,
  }) => {
    await login(page, E2E_MANAGER);
    await page.goto(admin('/pages/collections/blog'));
    await page.getByRole('table').getByRole('link', { name: 'Hello, world' }).first().click();
    await expect(page.locator('form[data-hydrated]')).toBeVisible();
    const tags = page.locator('[data-list-display="tags"]');
    const input = tags.getByRole('textbox', { name: 'Add to Tags' });
    const chips = tags.getByRole('listitem');
    await expect(chips).toHaveText(['News', 'Launch']);

    await input.fill('Product');
    await input.press('Enter');
    await expect(chips).toHaveText(['News', 'Launch', 'Product']);
    await expect(input).toBeFocused();

    await paste(page, '[aria-label="Add to Tags"]', 'Design, Speed\nNews');
    await expect(chips).toHaveText(['News', 'Launch', 'Product', 'Design', 'Speed']);

    await tags.getByRole('button', { name: 'Remove Design' }).click();
    await expect(chips).toHaveText(['News', 'Launch', 'Product', 'Speed']);

    const speed = tags.getByRole('button', { name: /^Speed/ });
    await speed.focus();
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(chips).toHaveText(['News', 'Launch', 'Speed', 'Product']);
    await page.keyboard.press('Delete');
    await expect(chips).toHaveText(['News', 'Launch', 'Product']);

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Saved/).first()).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-list-display="tags"]').getByRole('listitem')).toHaveText([
      'News',
      'Launch',
      'Product',
    ]);
    // The site receives plain strings.
    const html = await (await page.request.get('/blog/hello-world')).text();
    expect(html).toContain('Product');
  });
});
