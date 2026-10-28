import { request as playwrightRequest } from '@playwright/test';
import { expect, test } from './support/test';

import { login } from './support/auth';
import {
  updateSiteStatus,
  VISITOR_HEADERS,
  waitForPublicSite,
  openSettingsTab,
} from './support/settings';
import { E2E_ADMIN, E2E_MANAGER } from './support/users';
import { admin } from './support/admin';
import { FIRST_FORM_ID, SAMPLE_PATH } from './support/site';

test.describe.serial('site gate', () => {
  test('maintenance mode: visitors get 503, admin works, staff see the site', async ({
    page,
    baseURL,
  }) => {
    await login(page, E2E_ADMIN);
    await updateSiteStatus(page, { maintenance: true });

    const visitor = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: VISITOR_HEADERS,
    });
    await expect
      .poll(async () => (await visitor.get(SAMPLE_PATH, { maxRedirects: 0 })).status(), {
        timeout: 15_000,
      })
      .toBe(503);
    const response = await visitor.get(SAMPLE_PATH, { maxRedirects: 0 });
    expect(response.headers()['retry-after']).toBeTruthy();
    expect(await response.text()).toContain('We’ll be back soon');
    expect((await visitor.get(admin('/login'))).status()).toBe(200);
    if (FIRST_FORM_ID) {
      // Form endpoints (under the ungated /api) are closed to visitors too.
      const token = `/api/forms/token?form=${FIRST_FORM_ID}`;
      expect((await visitor.get(token)).status()).toBe(404);
      expect((await page.request.get(token)).status()).toBe(200);
    }
    await visitor.dispose();

    await page.goto(SAMPLE_PATH);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText('The site is paused')).toBeVisible();

    await updateSiteStatus(page, { maintenance: false });
    await waitForPublicSite(baseURL);
  });

  test('private mode: visitors must sign in; forged cookies are rejected; pages are noindex', async ({
    page,
    browser,
    baseURL,
  }) => {
    await login(page, E2E_ADMIN);
    await updateSiteStatus(page, { privateMode: true });

    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();
    await expect
      .poll(
        async () => {
          await visitorPage.goto(SAMPLE_PATH);
          return new URL(visitorPage.url()).pathname;
        },
        { timeout: 15_000 },
      )
      .toBe('/access');
    expect(new URL(visitorPage.url()).searchParams.get('next')).toBe(SAMPLE_PATH);

    // A forged site-gate cookie does not grant access.
    const host = new URL(baseURL ?? 'http://localhost').hostname;
    await visitor.addCookies([
      {
        name: 'site_gate',
        value: 'eyJ1aWQiOiJ4Iiwicm9sZSI6ImFkbWluIiwidiI6MCwiZXhwIjo5OTk5OTk5OTk5fQ.forged',
        domain: host,
        path: '/',
      },
    ]);
    await visitorPage.goto(SAMPLE_PATH);
    await expect(visitorPage).toHaveURL(
      (url) => url.pathname === '/access' && url.searchParams.get('next') === SAMPLE_PATH,
    );

    // A valid user gets in and lands on the requested page.
    await visitorPage.getByLabel('Email').fill(E2E_MANAGER.email);
    await visitorPage.getByLabel('Password').fill(E2E_MANAGER.password);
    await visitorPage.getByRole('button', { name: 'Sign in' }).click();
    await expect(visitorPage).toHaveURL((url) => url.pathname === SAMPLE_PATH);
    const pageResponse = await visitorPage.request.get(SAMPLE_PATH);
    expect(pageResponse.headers()['x-robots-tag']).toContain('noindex');
    await visitor.close();

    await updateSiteStatus(page, { privateMode: false });
    await waitForPublicSite(baseURL);
  });

  test('a settings server action called as a manager is rejected on the server', async ({
    browser,
  }) => {
    // Capture a real settings save request made by an admin…
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, E2E_ADMIN);
    const form = await openSettingsTab(adminPage, 'general', 'General');
    // Same name with a trailing space: the form is dirty, the stored value doesn't change.
    const name = form.getByLabel('Site name');
    await name.fill(`${await name.inputValue()} `);
    const [actionRequest] = await Promise.all([
      adminPage.waitForRequest(
        (req) => req.method() === 'POST' && Boolean(req.headers()['next-action']),
      ),
      adminPage.getByRole('button', { name: 'Save changes' }).click(),
    ]);
    await expect(adminPage.getByText('Settings saved.')).toBeVisible();
    await adminContext.close();

    // …and replay it with a manager's session.
    const managerContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    await login(managerPage, E2E_MANAGER);
    const replay = await managerPage.request.post(actionRequest.url(), {
      headers: {
        'next-action': actionRequest.headers()['next-action'] ?? '',
        'content-type': actionRequest.headers()['content-type'] ?? 'text/plain;charset=UTF-8',
        accept: 'text/x-component',
        origin: new URL(actionRequest.url()).origin,
      },
      data: actionRequest.postData() ?? '',
    });
    expect(await replay.text()).toContain('You are not allowed to perform this action.');
    await managerContext.close();
  });
});
