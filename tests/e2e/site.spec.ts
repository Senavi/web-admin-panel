import { devices, expect, test } from '@playwright/test';

const PAGES = [
  { path: '/', h1: 'Launch a fast website your team can edit' },
  { path: '/about', h1: 'About us' },
  { path: '/about/team', h1: 'Our team' },
  { path: '/contact', h1: 'Contact us' },
  { path: '/uk', h1: 'Запустіть швидкий сайт, який легко редагувати' },
  { path: '/uk/about', h1: 'Про нас' },
  { path: '/uk/about/team', h1: 'Наша команда' },
  { path: '/uk/contact', h1: 'Контакти' },
];

test.describe('demo site', () => {
  test.use({ extraHTTPHeaders: { 'accept-language': 'en' } });

  for (const { path, h1 } of PAGES) {
    test(`renders ${path} with one h1 and correct lang`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(h1);
      await expect(page.locator('html')).toHaveAttribute(
        'lang',
        path.startsWith('/uk') ? 'uk' : 'en',
      );
      await expect(page.locator('main#main')).toBeVisible();
    });
  }

  test('shared values fall back across locales', async ({ page }) => {
    await page.goto('/uk/contact');
    await expect(page.getByRole('link', { name: 'hello@example.com' })).toBeVisible();
  });

  test('images are served and have alt text', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('main img').first();
    await expect(hero).toHaveAttribute('alt', /.+/);
    expect(
      await hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    ).toBe(true);
  });

  test('the default locale prefix redirects to the unprefixed URL', async ({ page }) => {
    await page.goto('/en/about');
    await expect(page).toHaveURL(/\/about$/);
  });

  test('language switcher links to the same page in the other locale', async ({ page }) => {
    await page.goto('/about/team');
    await page
      .getByRole('navigation', { name: 'Language' })
      .first()
      .getByRole('link', { name: 'uk' })
      .click();
    await expect(page).toHaveURL(/\/uk\/about\/team$/);
  });

  test('first visit to / follows Accept-Language; crawlers are not redirected', async ({
    browser,
    request,
  }) => {
    const context = await browser.newContext({
      ...devices['Desktop Chrome'],
      // The browser locale drives the Accept-Language header of navigations.
      locale: 'uk-UA',
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/uk$/);
    await context.close();

    const bot = await request.get('/', {
      headers: { 'accept-language': 'uk', 'user-agent': 'Googlebot/2.1' },
      maxRedirects: 0,
    });
    expect(bot.status()).toBe(200);
  });

  test('unknown pages render the localized 404', async ({ page }) => {
    const response = await page.goto('/uk/does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Сторінку не знайдено' })).toBeVisible();
  });
});
