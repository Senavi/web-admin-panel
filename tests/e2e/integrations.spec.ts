import { createServer, type Server, type Socket } from 'node:net';

import { type Browser, type Page } from '@playwright/test';

import { admin } from './support/admin';
import { login } from './support/auth';
import { openSettingsTab, saveSettingsTab, VISITOR_HEADERS } from './support/settings';
import { expect, test } from './support/test';
import { E2E_ADMIN } from './support/users';

const GA_ID = 'G-E2ETEST123';
const SMTP_PASSWORD = 'smtp-secret-e2e';
const FILL_DELAY_MS = 3200;

// ── A tiny SMTP server: records every message and the credentials used ───────

interface Mail {
  readonly rcpt: string[];
  readonly data: string;
  readonly auth: { user: string; pass: string } | null;
}

async function startSmtp(): Promise<{ server: Server; port: number; mails: Mail[] }> {
  const mails: Mail[] = [];
  const server = createServer((socket: Socket) => {
    let buffer = '';
    let data: string | null = null;
    let rcpt: string[] = [];
    let auth: Mail['auth'] = null;
    const reply = (line: string) => socket.write(`${line}\r\n`);
    reply('220 localhost ESMTP');
    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      for (;;) {
        if (data !== null) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end < 0) return;
          mails.push({ rcpt, data: buffer.slice(0, end), auth });
          buffer = buffer.slice(end + 5);
          data = null;
          rcpt = [];
          reply('250 queued');
          continue;
        }
        const newline = buffer.indexOf('\r\n');
        if (newline < 0) return;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        const command = line.toUpperCase();
        if (command.startsWith('EHLO') || command.startsWith('HELO'))
          socket.write('250-localhost\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n');
        else if (command.startsWith('AUTH PLAIN')) {
          const [, user = '', pass = ''] = Buffer.from(line.split(' ')[2] ?? '', 'base64')
            .toString('utf8')
            .split('\0');
          auth = { user, pass };
          reply(pass === SMTP_PASSWORD ? '235 ok' : '535 bad credentials');
        } else if (command.startsWith('RCPT TO:')) {
          rcpt.push(line.slice(8).replace(/[<>\s]/g, ''));
          reply('250 ok');
        } else if (command === 'DATA') {
          data = '';
          reply('354 go');
        } else if (command === 'QUIT') {
          reply('221 bye');
          socket.end();
        } else reply('250 ok');
      }
    });
    socket.on('error', () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { server, port: typeof address === 'object' && address ? address.port : 0, mails };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function openIntegrations(page: Page) {
  await page.goto(admin('/settings?tab=integrations'));
  await expect(page.getByRole('heading', { name: 'Email for forms' })).toBeVisible();
}

async function chooseOption(page: Page, label: string, option: string | RegExp) {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option }).click();
}

async function setGoogleAnalytics(page: Page, on: boolean) {
  await openIntegrations(page);
  const card = page.getByRole('group', { name: 'Google Analytics 4' });
  const toggle = card.getByRole('switch');
  if ((await toggle.getAttribute('aria-checked')) !== String(on)) await toggle.click();
  if (on) await card.getByLabel('Measurement ID').fill(GA_ID);
  await card.getByRole('button', { name: 'Save Google Analytics 4' }).click();
  await expect(page.getByText('Google Analytics 4 saved.')).toBeVisible();
}

let ipCounter = 0;
async function visitor(browser: Browser) {
  ipCounter += 1;
  const context = await browser.newContext({
    extraHTTPHeaders: {
      ...VISITOR_HEADERS,
      'x-forwarded-for': `198.51.100.${(Date.now() % 150) + ipCounter}`,
    },
  });
  return { context, page: await context.newPage() };
}

async function submitContact(page: Page, name: string) {
  await page.goto('/contact');
  await expect(page.locator('form#form-contact input[name="_t"]')).toBeAttached();
  await page.locator('#contact-consent').check();
  await page.locator('#contact-name').fill(name);
  await page.locator('#contact-email').fill('visitor@example.test');
  await page.locator('#contact-message').fill('Hello from the integrations test.');
  await page.waitForTimeout(FILL_DELAY_MS);
  await page.locator('form#form-contact button[type="submit"]').click();
  await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
}

// ── Analytics and the cookie banner ──────────────────────────────────────────

test.describe.serial('integrations: analytics and cookie consent', () => {
  test.afterAll(async ({ browser, baseURL }) => {
    const page = await browser.newPage({ baseURL });
    await login(page, E2E_ADMIN);
    await setGoogleAnalytics(page, false);
    await page.close();
  });

  test('with Google Analytics on, nothing loads until Accept; Decline never loads it', async ({
    page,
    browser,
  }) => {
    await login(page, E2E_ADMIN);
    await setGoogleAnalytics(page, true);

    // The site CSP learns the new origin at runtime (no rebuild).
    const headers = { ...VISITOR_HEADERS };
    await expect
      .poll(
        async () => (await page.request.get('/', { headers })).headers()['content-security-policy'],
      )
      .toContain('https://www.googletagmanager.com');

    const loaded: string[] = [];
    const route = async (context: Awaited<ReturnType<typeof visitor>>['context']) =>
      context.route('https://www.googletagmanager.com/**', (request) => {
        loaded.push(request.request().url());
        return request.fulfill({ contentType: 'text/javascript', body: 'window.__gtag = true;' });
      });

    // Accept.
    const accepting = await visitor(browser);
    await route(accepting.context);
    await accepting.page.goto('/');
    const banner = accepting.page.getByRole('region', { name: 'Cookies' });
    await expect(banner).toBeVisible();
    await accepting.page.waitForTimeout(1500);
    expect(loaded).toEqual([]);
    await banner.getByRole('button', { name: 'Accept' }).click();
    await expect(banner).toBeHidden();
    await expect.poll(() => loaded.some((url) => url.includes(GA_ID))).toBe(true);
    // The choice is remembered: no banner on the next page, and the link reopens it.
    await accepting.page.goto('/about');
    await expect(accepting.page.getByRole('region', { name: 'Cookies' })).toHaveCount(0);
    await accepting.page.getByRole('button', { name: 'Cookie settings' }).click();
    await expect(accepting.page.getByRole('region', { name: 'Cookies' })).toBeVisible();
    await accepting.context.close();

    // Decline.
    loaded.length = 0;
    const declining = await visitor(browser);
    await route(declining.context);
    await declining.page.goto('/');
    await declining.page
      .getByRole('region', { name: 'Cookies' })
      .getByRole('button', { name: 'Decline' })
      .click();
    await declining.page.goto('/about');
    await declining.page.waitForTimeout(2000);
    expect(loaded).toEqual([]);
    await expect(declining.page.getByRole('region', { name: 'Cookies' })).toHaveCount(0);
    await declining.context.close();
  });

  test('an invalid ID is refused and nothing is turned on', async ({ page }) => {
    await login(page, E2E_ADMIN);
    await openIntegrations(page);
    const card = page.getByRole('group', { name: 'Google Tag Manager' });
    await card.getByRole('switch').click();
    await card.getByLabel('Container ID').fill('G-WRONG');
    await card.getByRole('button', { name: 'Save Google Tag Manager' }).click();
    await expect(card.getByRole('alert')).toContainText('GTM-');
    await expect(card.locator('[data-status]')).toHaveText('Off');
  });

  test('managers do not see the Integrations tab', async ({ browser }) => {
    const { E2E_MANAGER } = await import('./support/users');
    const page = await browser.newPage();
    await login(page, E2E_MANAGER);
    await page.goto(admin('/settings'));
    await expect(page.getByRole('tab', { name: 'Integrations' })).toHaveCount(0);
    await page.close();
  });
});

// ── Email for forms ──────────────────────────────────────────────────────────

test.describe.serial('integrations: email for forms', () => {
  let smtp: Awaited<ReturnType<typeof startSmtp>>;

  test.beforeAll(async () => {
    smtp = await startSmtp();
  });

  test.afterAll(async ({ browser, baseURL }) => {
    smtp.server.close();
    // Back to the default: no provider, no recipients.
    const page = await browser.newPage({ baseURL });
    await login(page, E2E_ADMIN);
    await openIntegrations(page);
    await chooseOption(page, 'Email service', 'Not connected');
    await page.getByRole('button', { name: 'Save email' }).click();
    await expect(page.getByText('Email saved.')).toBeVisible();
    const form = await openSettingsTab(page, 'requests', 'Requests');
    await form.getByLabel('Default recipients').fill('');
    await form.getByLabel('Send requests to').fill('');
    if (await page.getByRole('region', { name: 'Unsaved changes' }).isVisible())
      await saveSettingsTab(page);
    await page.close();
  });

  test('connect SMTP, keep the password write-only, and send a test email', async ({ page }) => {
    await login(page, E2E_ADMIN);
    await openIntegrations(page);
    const card = page.getByRole('group', { name: 'Email' });
    await chooseOption(page, 'Email service', /SMTP/);
    await card.getByLabel('Sender').fill('Site <forms@example.test>');
    await card.getByLabel('SMTP server').fill('127.0.0.1');
    await card.getByLabel('Port').fill(String(smtp.port));
    await chooseOption(page, 'Connection security', /None/);
    await card.getByLabel('User name').fill('mailer');
    await card.getByLabel('Password').fill(SMTP_PASSWORD);
    await card.getByRole('button', { name: 'Save password' }).click();
    await expect(page.getByText('Password saved.')).toBeVisible();
    // Never shown again.
    await expect(card.locator('[data-secret="smtp.password"]')).toContainText('••••');
    await expect(page.locator('body')).not.toContainText(SMTP_PASSWORD);
    await expect(card.getByRole('button', { name: 'Replace' })).toBeVisible();

    await card.getByRole('button', { name: 'Save email' }).click();
    await expect(page.getByText('Email saved.')).toBeVisible();
    await card.getByRole('button', { name: 'Send test email' }).click();
    await expect(page.getByText(`Test email sent to ${E2E_ADMIN.email}.`)).toBeVisible();

    await expect.poll(() => smtp.mails.length).toBeGreaterThan(0);
    const mail = smtp.mails[0];
    expect(mail?.rcpt).toContain(E2E_ADMIN.email);
    expect(mail?.auth).toEqual({ user: 'mailer', pass: SMTP_PASSWORD });
    await page.reload();
    await expect(card.locator('[data-status]')).toHaveText('On');
  });

  test('warns when email is connected but nobody receives requests', async ({ page }) => {
    await login(page, E2E_ADMIN);
    const form = await openSettingsTab(page, 'requests', 'Requests');
    await form.getByLabel('Default recipients').fill('');
    await form.getByLabel('Send requests to').fill('');
    if (await page.getByRole('region', { name: 'Unsaved changes' }).isVisible())
      await saveSettingsTab(page);
    await page.reload();
    await expect(page.getByTestId('no-recipients-warning')).toBeVisible();
    await page.goto(admin());
    await expect(page.getByTestId('no-recipients-warning')).toBeVisible();
  });

  test('default recipients get every submission; a form’s own list overrides them', async ({
    page,
    browser,
  }) => {
    await login(page, E2E_ADMIN);
    const form = await openSettingsTab(page, 'requests', 'Requests');
    await form.getByLabel('Default recipients').fill('team@example.test');
    await form.getByLabel('Send requests to').fill('');
    await saveSettingsTab(page);
    await expect(page.getByTestId('no-recipients-warning')).toHaveCount(0);

    const first = await visitor(browser);
    await submitContact(first.page, 'Default recipients test');
    await first.context.close();
    await expect
      .poll(() =>
        smtp.mails.some(
          (mail) =>
            mail.rcpt.includes('team@example.test') &&
            mail.data.includes('Subject: New submission: Contact form'),
        ),
      )
      .toBe(true);

    const own = await openSettingsTab(page, 'requests', 'Requests');
    await own.getByLabel('Send requests to').fill('owner@example.test');
    await saveSettingsTab(page);
    const second = await visitor(browser);
    await submitContact(second.page, 'Own recipients test');
    await second.context.close();
    await expect
      .poll(() => smtp.mails.some((mail) => mail.rcpt.join() === 'owner@example.test'))
      .toBe(true);
  });
});
