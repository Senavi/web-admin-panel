import { expect, test } from '@playwright/test';
import { admin } from '../e2e/support/admin';

/** A production build with no database variables: demo site from seeds, admin setup guide. */
test.describe('preview mode (no DATABASE_URL)', () => {
  test('serves the demo pages, posts and images from seeds, never indexable', async ({
    page,
    request,
  }) => {
    for (const path of ['/', '/about', '/uk/about', '/blog', '/blog/hello-world']) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      expect(response?.headers()['x-robots-tag'], path).toContain('noindex');
      await expect(page.locator('h1'), path).toHaveCount(1);
    }
    await page.goto('/');
    const hero = page.locator('main img').first();
    await expect(hero).toBeVisible();
    expect(await hero.getAttribute('src')).toContain('seed-assets');
    expect(await hero.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

    await page.goto('/blog');
    await expect(page.getByRole('link', { name: /Hello, world/ }).first()).toBeVisible();

    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toMatch(/Disallow: \/\s*$/m);
    expect(await (await request.get('/sitemap.xml')).text()).not.toContain('<url>');
    expect((await request.get('/nope-does-not-exist')).status()).toBe(404);
  });

  test('every admin URL shows the setup guide (no login, no data)', async ({ page, request }) => {
    for (const path of [admin(), admin('/settings'), admin('/login'), admin('/pages/home')]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(
        page.getByRole('heading', { name: 'This site isn’t connected to a database yet' }),
      ).toBeVisible();
    }
    await expect(page.getByText('SUPABASE_SERVICE_ROLE_KEY')).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
    // Database-backed APIs are off.
    expect((await request.get('/api/auth/get-session')).status()).toBe(404);
    expect((await request.post('/api/media')).status()).toBe(404);
  });

  test('forms render but say they are not connected yet', async ({ page, request, baseURL }) => {
    await page.goto('/contact');
    await expect(page.locator('form#form-contact')).toBeVisible();
    await page.waitForLoadState('networkidle'); // hydrated (the timing token request fails: 503)
    await page.locator('#contact-consent').check();
    await page.locator('#contact-name').fill('Preview Visitor');
    await page.locator('#contact-email').fill('visitor@example.test');
    await page.locator('#contact-message').fill('Hello from preview mode.');
    await page.locator('form#form-contact button[type="submit"]').click();
    await expect(page.getByText('This form isn’t connected yet', { exact: false })).toBeVisible();

    const response = await request.post('/api/forms/submit', {
      headers: { origin: new URL(baseURL ?? '').origin, accept: 'application/json' },
      form: { form: 'contact' },
    });
    expect(response.status()).toBe(503);
    expect((await response.json()).message).toBe('This form isn’t connected yet.');
  });
});
