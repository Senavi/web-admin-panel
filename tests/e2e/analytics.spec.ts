import { devices, expect, type Page, test } from '@playwright/test';

import { login } from './support/auth';
import { E2E_ADMIN } from './support/users';

async function kpis(page: Page): Promise<{ visitors: number; views: number }> {
  await page.goto('/admin?range=today');
  const read = async (id: string) =>
    Number((await page.getByTestId(id).textContent())?.replace(/\D/g, '') ?? '0');
  return { visitors: await read('kpi-unique-visitors'), views: await read('kpi-page-views') };
}

test('visiting demo pages records page views and a unique visitor; bots are ignored', async ({
  page,
  browser,
  baseURL,
}) => {
  await login(page, E2E_ADMIN);
  const before = await kpis(page);

  // A distinct user agent makes this a new visitor for today (same IP + UA = same daily hash).
  const userAgent = `${devices['Desktop Chrome'].userAgent} e2e-${Date.now()}`;
  const visitor = await browser.newContext({
    ...devices['Desktop Chrome'],
    userAgent,
    locale: 'en-US',
  });
  const visitorPage = await visitor.newPage();
  for (const path of ['/', '/about']) {
    const beacon = visitorPage.waitForRequest(
      (request) => request.url().endsWith('/api/collect') && request.method() === 'POST',
    );
    await visitorPage.goto(path);
    await beacon;
  }
  await visitor.close();

  const bot = await page.request.post('/api/collect', {
    headers: {
      origin: baseURL ?? '',
      'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    },
    data: JSON.stringify({ p: '/contact' }),
  });
  expect(bot.status()).toBe(204);

  await expect
    .poll(async () => kpis(page), { timeout: 15_000 })
    .toEqual({
      visitors: before.visitors + 1,
      views: before.views + 2,
    });
});
