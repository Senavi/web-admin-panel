import { resolveConfig } from 'prettier';
import { describe, expect, it } from 'vitest';

/**
 * Template files sort their Tailwind classes by the admin stylesheet, project files
 * by the site theme: a project changing its tokens never reformats template files.
 */
const ADMIN_CSS = './src/admin/styles/admin.css';
const SITE_CSS = './src/site/theme/site.css';

describe('Prettier Tailwind stylesheet per area', () => {
  it.each([
    ['src/admin/components/layout/environment-bar.tsx', ADMIN_CSS],
    ['src/core/forms/security-fields.tsx', ADMIN_CSS],
    ['src/app/(admin)/admin/(panel)/layout.tsx', ADMIN_CSS],
    ['src/app/(access)/access/layout.tsx', ADMIN_CSS],
    ['src/site/sections/hero.tsx', SITE_CSS],
    ['src/app/(site)/[locale]/layout.tsx', SITE_CSS],
  ])('%s → %s', async (file, stylesheet) => {
    const config = await resolveConfig(file);
    expect(config?.tailwindStylesheet).toBe(stylesheet);
    expect(config?.endOfLine).toBe('lf');
  });
});
