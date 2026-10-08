import { expect, request, test } from '@playwright/test';

import { login } from './support/auth';
import {
  setEnabledLocales,
  updateSiteStatus,
  VISITOR_HEADERS,
  waitForPublicSite,
} from './support/settings';
import { E2E_ADMIN } from './support/users';

test.describe.serial('SEO and i18n', () => {
  test('pages carry canonical, hreflang, OG tags and JSON-LD', async ({ page }) => {
    await page.goto('/uk/about/team');
    await expect(page).toHaveTitle('Наша команда');
    const head = page.locator('head');
    await expect(head.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/uk\/about\/team$/,
    );
    await expect(head.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      /\/about\/team$/,
    );
    await expect(head.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      'href',
      /\/about\/team$/,
    );
    await expect(head.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /\/og\/uk\/team\.png$/,
    );
    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').first().textContent()) ?? '{}',
    );
    expect(JSON.stringify(jsonLd)).toContain('BreadcrumbList');

    const og = await page.request.get('/og/uk/team.png');
    expect(og.headers()['content-type']).toBe('image/png');
  });

  test('unknown URLs return the localized 404 with status 404', async ({ baseURL }) => {
    const visitor = await request.newContext({ baseURL, extraHTTPHeaders: VISITOR_HEADERS });
    const response = await visitor.get('/uk/no-such-page');
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain('Сторінку не знайдено');
    await visitor.dispose();
  });

  test('indexing ON: robots allows the site and the sitemap lists every locale with hreflang', async ({
    baseURL,
  }) => {
    const visitor = await request.newContext({ baseURL });
    const robots = await (await visitor.get('/robots.txt')).text();
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Disallow: /admin');
    const sitemap = await (await visitor.get('/sitemap.xml')).text();
    expect(sitemap).toMatch(/<loc>[^<]*\/uk\/about<\/loc>/);
    expect(sitemap).toMatch(/hreflang="uk"/);
    expect(sitemap).toMatch(/hreflang="en"/);
    await visitor.dispose();
  });

  test('indexing OFF: robots disallows everything and responses send noindex', async ({
    page,
    baseURL,
  }) => {
    await login(page, E2E_ADMIN);
    await updateSiteStatus(page, { indexing: false });
    const visitor = await request.newContext({ baseURL, extraHTTPHeaders: VISITOR_HEADERS });
    await expect
      .poll(async () => (await visitor.get('/about')).headers()['x-robots-tag'] ?? '', {
        timeout: 15_000,
      })
      .toContain('noindex');
    await expect
      .poll(async () => (await visitor.get('/robots.txt')).text(), { timeout: 15_000 })
      .toMatch(/Disallow: \/\s*$/m);
    const html = await (await visitor.get('/about')).text();
    expect(html).toMatch(/<meta name="robots" content="noindex, ?nofollow"/);
    await visitor.dispose();
    await updateSiteStatus(page, { indexing: true });
    await waitForPublicSite(baseURL);
  });

  test('disabling a locale makes its URLs 404 and removes it from the sitemap', async ({
    page,
    baseURL,
  }) => {
    await login(page, E2E_ADMIN);
    await setEnabledLocales(page, ['en']);
    const visitor = await request.newContext({ baseURL, extraHTTPHeaders: VISITOR_HEADERS });
    await expect
      .poll(async () => (await visitor.get('/uk/about')).status(), { timeout: 15_000 })
      .toBe(404);
    await expect
      .poll(async () => (await visitor.get('/sitemap.xml')).text(), { timeout: 15_000 })
      .not.toContain('/uk');
    expect((await visitor.get('/about')).status()).toBe(200);
    await visitor.dispose();
    await setEnabledLocales(page, ['en', 'uk']);
    const check = await request.newContext({ baseURL, extraHTTPHeaders: VISITOR_HEADERS });
    await expect
      .poll(async () => (await check.get('/uk/about')).status(), { timeout: 15_000 })
      .toBe(200);
    await check.dispose();
  });
});
