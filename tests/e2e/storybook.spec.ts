import { tokens } from '@/site/theme/tokens.generated';

import { login } from './support/auth';
import { expect, test } from './support/test';
import { E2E_ADMIN, E2E_MANAGER } from './support/users';

const HEX = /^#[0-9a-f]{3,8}$/i;
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `clamp(2.25rem, …, 3.5rem)` → ['36px', '56px'] (the metrics table shows both ends). */
function clampPx(size: string): string[] {
  const match = /clamp\(\s*([\d.]+)rem\s*,.*,\s*([\d.]+)rem\s*\)/.exec(size);
  return match ? [match[1], match[2]].map((rem) => `${Number(rem) * 16}px`) : [];
}

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
      // Values come from the project's theme (src/site/theme/tokens.css).
      const primary = page
        .getByRole('listitem')
        .filter({ hasText: new RegExp(`^primary${escapeRegExp(tokens.color.primary)}`) })
        .first();
      await expect(primary).toBeVisible();
      // The contrast ratio is computed for hex colors.
      if (HEX.test(tokens.color.primary))
        await expect(primary).toContainText(/\d+\.\d:1 (AAA|AA|Fail)/);
      const h1 = page.getByRole('table', { name: 'Metrics of h1' });
      await expect(h1).toBeVisible();
      for (const px of clampPx(tokens.type.h1.size)) await expect(h1).toContainText(px);

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
