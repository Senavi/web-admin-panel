import { expect, type Page, test } from '@playwright/test';

import { login } from './support/auth';
import { E2E_ADMIN, E2E_MANAGER } from './support/users';

/** Visitor-like request (no cookies from the test page). */
const VISITOR = { 'user-agent': 'Mozilla/5.0 Chrome/150', 'accept-language': 'en' };

async function visit(page: Page, path: string) {
  const response = await page.context().request.fetch(path, {
    headers: VISITOR,
    maxRedirects: 0,
  });
  return {
    status: response.status(),
    location: response.headers().location ?? '',
    html: await response.text(),
  };
}

async function sitemap(page: Page): Promise<string> {
  return (await visit(page, '/sitemap.xml')).html;
}

async function openEditor(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator('form[data-hydrated]')).toBeVisible();
}

const saveButton = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });
const titleInput = (page: Page) => page.getByRole('textbox', { name: 'Title' }).first();

async function chooseStatus(page: Page, label: 'Published' | 'Draft (only staff can preview)') {
  await page.getByRole('combobox', { name: 'Status' }).click();
  await page.getByRole('option', { name: label }).click();
}

test.describe.serial('collections', () => {
  const stamp = Date.now();
  const title = `E2E post ${stamp}`;
  const slug = `e2e-post-${stamp}`;
  const renamed = `${slug}-renamed`;
  let editorUrl = '';

  test('a manager creates a draft: 404 for visitors, not in the sitemap, staff can preview', async ({
    page,
  }) => {
    await login(page, E2E_MANAGER);
    await page.goto('/admin/pages/collections/blog');
    await page.getByRole('button', { name: 'New post' }).click();
    await expect(page).toHaveURL(/\/admin\/pages\/collections\/blog\/[0-9a-f-]{36}$/);
    await expect(page.locator('form[data-hydrated]')).toBeVisible();
    editorUrl = page.url();

    await titleInput(page).fill(title);
    await page.getByRole('textbox', { name: 'Text', exact: true }).click();
    await page.keyboard.type('A post written by the end-to-end tests.');
    await page.getByLabel('URL slug').fill(slug);
    await saveButton(page).click();
    await expect(page.getByText('Saved as a draft (not visible on the site).')).toBeVisible();

    expect((await visit(page, `/blog/${slug}`)).status).toBe(404);
    expect((await visit(page, '/blog')).html).not.toContain(title);
    expect(await sitemap(page)).not.toContain(slug);

    // Staff preview (Draft Mode) shows the draft with a notice; leaving it restores the 404.
    const preview = await page.getByRole('button', { name: 'Preview' }).getAttribute('href');
    expect(preview).toBeTruthy();
    await page.goto(preview ?? '');
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Preview' })).toBeVisible();
    await page.getByRole('button', { name: 'Exit preview' }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toHaveCount(0);
  });

  test('publishing shows it on the list, its page and the sitemap; uk falls back', async ({
    page,
  }) => {
    await login(page, E2E_MANAGER);
    await openEditor(page, editorUrl);
    await chooseStatus(page, 'Published');
    await saveButton(page).click();
    await expect(page.getByText('Saved. The live site updates in a few seconds.')).toBeVisible();

    await expect.poll(async () => (await visit(page, `/blog/${slug}`)).status).toBe(200);
    expect((await visit(page, '/blog')).html).toContain(title);
    const map = await sitemap(page);
    expect(map).toContain(`/blog/${slug}</loc>`);
    expect(map).toContain(`/uk/blog/${slug}</loc>`);
    // Not translated: the uk page falls back to the English content.
    const uk = await visit(page, `/uk/blog/${slug}`);
    expect(uk.status).toBe(200);
    expect(uk.html).toContain(title);
  });

  test('pagination uses real URLs; pages beyond the last one are 404', async ({ page }) => {
    // 4 published posts, 3 per page.
    const second = await visit(page, '/blog?page=2');
    expect(second.status).toBe(200);
    expect(second.html).toContain('Hello, world');
    expect(second.html).toMatch(/<link rel="canonical" href="[^"]*\/blog\?page=2"/);
    expect((await visit(page, '/blog?page=3')).status).toBe(404);
    expect((await visit(page, '/blog?page=0')).status).toBe(404);
  });

  test('changing the slug redirects the old URL with 308', async ({ page }) => {
    await login(page, E2E_MANAGER);
    await openEditor(page, editorUrl);
    await page.getByLabel('URL slug').fill(renamed);
    await saveButton(page).click();
    await expect(page.getByText(/^Saved\./)).toBeVisible();

    await expect
      .poll(async () => {
        const old = await visit(page, `/blog/${slug}`);
        return `${old.status} ${old.location}`;
      })
      .toMatch(new RegExp(`^308 .*/blog/${renamed}$`));
    expect((await visit(page, `/blog/${renamed}`)).status).toBe(200);
  });

  test('a concurrent edit is detected and a revision can be restored', async ({ browser }) => {
    const first = await browser.newPage();
    const second = await browser.newPage();
    await login(first, E2E_ADMIN);
    await login(second, E2E_MANAGER);
    await openEditor(first, editorUrl);
    await openEditor(second, editorUrl);

    await titleInput(first).fill(`${title} (edited)`);
    await saveButton(first).click();
    await expect(first.getByText(/^Saved\./)).toBeVisible();
    await titleInput(second).fill(`${title} (conflict)`);
    await saveButton(second).click();
    await expect(second.getByText('This was changed by someone else')).toBeVisible();

    await first.getByRole('button', { name: 'History' }).click();
    const revisions = first.getByRole('list', { name: 'Revisions' }).getByRole('button');
    await revisions.nth(1).click();
    await first.getByRole('button', { name: 'Restore this version' }).click();
    await expect(first.getByText('Revision restored.')).toBeVisible();
    await expect(titleInput(first)).toHaveValue(title);
    await expect
      .poll(async () => (await visit(first, `/blog/${renamed}`)).html)
      .toContain(`>${title}<`);
    await first.close();
    await second.close();
  });

  test('deleting a post: 404, gone from the sitemap, the audit log shows its title', async ({
    page,
  }) => {
    await login(page, E2E_ADMIN);
    await openEditor(page, editorUrl);
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/admin\/pages\/collections\/blog$/);

    await expect.poll(async () => (await visit(page, `/blog/${renamed}`)).status).toBe(404);
    // The proxy refreshes its view of published slugs and redirects within seconds.
    await expect.poll(async () => (await visit(page, `/blog/${slug}`)).status).toBe(404);
    expect(await sitemap(page)).not.toContain(renamed);

    await page.goto('/admin/security');
    const audit = page.getByRole('table', { name: 'Audit log' });
    await expect(audit).toContainText('Deleted an item');
    await expect(audit).toContainText(`Blog: ${title}`);
  });
});
