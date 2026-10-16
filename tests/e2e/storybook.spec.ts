import { login } from './support/auth';
import { expect, test } from './support/test';
import { E2E_ADMIN, E2E_MANAGER } from './support/users';

/** `/storybook`: the site's living style guide, for staff only. */
test.describe('storybook', () => {
  test('visitors get the site 404, not a login redirect; it is not advertised', async ({
    request,
  }) => {
    const response = await request.get('/storybook', { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    expect(response.headers()['x-robots-tag']).toContain('noindex');
    expect(response.headers()['cache-control']).toContain('no-store');
    const missing = await request.get('/nope-does-not-exist');
    // Same page as any unknown URL.
    const title = (html: string) => /<h1[^>]*>([^<]*)/.exec(html)?.[1];
    expect(title(await response.text())).toBe(title(await missing.text()));
    expect(await (await request.get('/robots.txt')).text()).not.toContain('storybook');
    expect(await (await request.get('/sitemap.xml')).text()).not.toContain('storybook');
  });

  for (const [role, user] of [
    ['an admin', E2E_ADMIN],
    ['a manager', E2E_MANAGER],
  ] as const) {
    test(`${role} sees tokens and the project's components`, async ({ page }) => {
      await login(page, user);
      const response = await page.goto('/storybook');
      expect(response?.status()).toBe(200);
      expect(response?.headers()['x-robots-tag']).toContain('noindex');
      expect(response?.headers()['cache-control']).toContain('no-store');
      await expect(page.getByRole('heading', { name: 'Storybook', level: 1 })).toBeVisible();

      // Tokens, rendered by core.
      for (const title of ['Colors', 'Fonts', 'Text styles', 'Spacing', 'Radii', 'Shadows']) {
        await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible();
      }
      const primary = page
        .getByRole('listitem')
        .filter({ hasText: /^primary#/ })
        .first();
      await expect(primary).toContainText('#2546ea');
      await expect(primary).toContainText(/\d+\.\d:1 AA/);
      const h1 = page.getByRole('table', { name: 'Metrics of h1' });
      await expect(h1).toContainText('36px');
      await expect(h1).toContainText('56px');

      // The project's slot.
      for (const title of ['Buttons', 'Form fields', 'Icons', 'Other primitives']) {
        await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible();
      }
      const buttons = page.getByRole('table', { name: 'Button variants in every state' });
      for (const variant of ['primary', 'secondary', 'tertiary', 'ghost', 'link']) {
        await expect(buttons.getByRole('rowheader', { name: variant })).toBeVisible();
      }
      await expect(buttons.getByRole('button', { name: 'Button', disabled: true })).toHaveCount(5);
      await expect(page.getByLabel('Input (error)')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByLabel('Input (disabled)')).toBeDisabled();
      await expect(page.getByText('lucide-react')).toBeVisible();
    });
  }
});
