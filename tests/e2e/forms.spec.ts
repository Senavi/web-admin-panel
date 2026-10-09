import { createHmac } from 'node:crypto';
import fs from 'node:fs/promises';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import path from 'node:path';

import { type Browser, expect, type Page, test } from '@playwright/test';

import { login } from './support/auth';
import { E2E_ENV } from './support/env';
import { E2E_ADMIN, E2E_MANAGER } from './support/users';

/** Same data dir as the server under test (dev e2e: .data/e2e; prod e2e: SITE_DATA_DIR). */
const DATA_DIR = process.env.SITE_DATA_DIR ?? (process.env.E2E_BASE_URL ? '.data' : '.data/e2e');
const MAIL_DIR = path.join(DATA_DIR, 'mail');
/** Signed timing token: humans need ≥ 3 s. */
const FILL_DELAY_MS = 3200;
const WEBHOOK_PORT = 4590;
const WEBHOOK_URL = `http://127.0.0.1:${WEBHOOK_PORT}/hook`;

const stamp = Date.now();
let ipCounter = 0;
/** Each scenario gets its own client IP so per-visitor rate limits don't interfere. */
async function visitor(browser: Browser, options: { javaScriptEnabled?: boolean } = {}) {
  ipCounter += 1;
  const context = await browser.newContext({
    ...options,
    extraHTTPHeaders: { 'x-forwarded-for': `203.0.113.${(stamp % 200) + ipCounter}` },
  });
  return { context, page: await context.newPage() };
}

interface ContactInput {
  readonly name?: string;
  readonly email?: string;
  readonly message?: string;
  readonly consent?: boolean;
}

/** Opens the contact page; with JavaScript, waits for the hydrated form's timing token. */
async function openContact(page: Page, pathname = '/contact', javaScript = true): Promise<void> {
  await page.goto(pathname);
  await expect(page.locator('form#form-contact')).toBeVisible();
  if (javaScript) await expect(page.locator('form#form-contact input[name="_t"]')).toBeAttached();
}

async function fill(page: Page, input: ContactInput): Promise<void> {
  // Consent first: inline re-validation of the text fields resizes the error summary.
  if (input.consent) await page.locator('#contact-consent').check();
  if (input.name !== undefined) await page.locator('#contact-name').fill(input.name);
  if (input.email !== undefined) await page.locator('#contact-email').fill(input.email);
  if (input.message !== undefined) await page.locator('#contact-message').fill(input.message);
}

async function submit(page: Page): Promise<void> {
  await page.waitForTimeout(FILL_DELAY_MS);
  await page.locator('form#form-contact button[type="submit"]').click();
}

const valid = (name: string): ContactInput => ({
  name,
  email: 'visitor@example.test',
  message: 'Hello from the end-to-end tests.',
  consent: true,
});

/** Submissions in the admin inbox whose data contains `search` (all statuses). */
async function inboxCount(page: Page, search: string): Promise<number> {
  await page.goto(`/admin/pages/forms/contact?status=all&q=${encodeURIComponent(search)}`);
  const rows = page.getByRole('table', { name: 'Submissions' }).getByRole('row');
  await expect(rows.first()).toBeVisible();
  if (await page.getByText('No submissions here.').isVisible()) return 0;
  return (await rows.count()) - 1;
}

/** Settings → Forms for the contact form (as admin). */
async function configureDelivery(page: Page, options: { email: boolean; webhook: boolean }) {
  await page.goto('/admin/settings');
  const form = page.locator('form[aria-label="Forms"][data-hydrated]');
  await expect(form).toBeVisible();
  const toggle = async (name: string, on: boolean) => {
    const control = form.getByRole('switch', { name, exact: true });
    if ((await control.getAttribute('aria-checked')) !== String(on)) await control.click();
  };
  await toggle('Email', options.email);
  await form.getByLabel('Recipients').fill('inbox@example.test');
  await toggle('Webhook', options.webhook);
  await form.getByLabel('Webhook URL').fill(WEBHOOK_URL);
  if (!(await form.getByRole('button', { name: 'Save' }).isEnabled())) return; // unchanged
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Settings saved.').last()).toBeVisible();
}

interface Received {
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
}

function startWebhookServer(received: Received[]): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
      request.on('end', () => {
        received.push({ headers: request.headers, body });
        response.writeHead(204).end();
      });
    });
    server.listen(WEBHOOK_PORT, '127.0.0.1', () => resolve(server));
  });
}

test.describe.serial('forms', () => {
  test('works without JavaScript: native validation, confirm step, success page', async ({
    browser,
  }) => {
    const { context, page } = await visitor(browser, { javaScriptEnabled: false });
    await openContact(page, '/contact', false);
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') posts.push(request.url());
    });
    // Required fields are checked by the browser: nothing is sent.
    await page.locator('form#form-contact button[type="submit"]').click();
    await page.waitForTimeout(500);
    expect(posts).toEqual([]);

    // The timing token needs JavaScript to reach the form, so the server asks to confirm once.
    await fill(page, valid(`NoJS ${stamp}`));
    await page.locator('form#form-contact button[type="submit"]').click();
    await expect(page.getByRole('status')).toHaveText(
      'Please press the button to send your message.',
    );
    await page.waitForTimeout(FILL_DELAY_MS);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
    await context.close();
  });

  test('with JavaScript: localized accessible errors, focus on the summary, success', async ({
    browser,
  }) => {
    const { context, page } = await visitor(browser);
    await openContact(page, '/uk/contact');
    await page.locator('form#form-contact button[type="submit"]').click();
    const summary = page.getByRole('alert').filter({ hasText: 'Виправте, будь ласка' });
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    const name = page.locator('#contact-name');
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toHaveAttribute('aria-describedby', /contact-name-error/);
    await expect(page.locator('#contact-name-error')).toHaveText('Це поле обов’язкове.');

    await fill(page, valid(`Script ${stamp}`));
    await submit(page);
    await expect(page.getByRole('heading', { name: 'Дякуємо!' })).toBeVisible();
    await context.close();
  });

  test('honeypot and too-fast submissions are dropped silently', async ({ browser, page }) => {
    const bot = await visitor(browser);
    await openContact(bot.page);
    await fill(bot.page, valid(`Honeypot ${stamp}`));
    await bot.page.locator('input[name="website"]').fill('https://spam.example', { force: true });
    await submit(bot.page);
    await expect(bot.page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();

    await openContact(bot.page);
    await fill(bot.page, valid(`TooFast ${stamp}`));
    await bot.page.locator('form#form-contact button[type="submit"]').click(); // no delay
    await expect(bot.page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
    await bot.context.close();

    await login(page, E2E_ADMIN);
    expect(await inboxCount(page, `Honeypot ${stamp}`)).toBe(0);
    expect(await inboxCount(page, `TooFast ${stamp}`)).toBe(0);
    expect(await inboxCount(page, `Script ${stamp}`)).toBe(1);
  });

  test('a visitor is rate limited after five submissions', async ({ browser }) => {
    const { context, page } = await visitor(browser);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await openContact(page);
      await fill(page, valid(`Limit ${stamp} ${attempt}`));
      await submit(page);
      await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
    }
    await openContact(page);
    await fill(page, valid(`Limit ${stamp} 6`));
    await submit(page);
    await expect(page.getByText(/Too many messages/)).toBeVisible();
    await context.close();
  });

  test('delivery: inbox unread count, dev email file and a signed webhook', async ({
    browser,
    page,
  }) => {
    const received: Received[] = [];
    const server = await startWebhookServer(received);
    try {
      await login(page, E2E_ADMIN);
      await configureDelivery(page, { email: true, webhook: true });

      const { context, page: guest } = await visitor(browser);
      const name = `Delivered ${stamp}`;
      await openContact(guest);
      await fill(guest, valid(name));
      await submit(guest);
      await expect(guest.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
      await context.close();

      // Unread count in the Pages sidebar.
      await page.goto('/admin/pages/forms/contact');
      await expect(
        page.getByRole('region', { name: 'Forms' }).getByLabel(/[1-9][0-9]* new/),
      ).toBeVisible();

      // The dev mail provider wrote the email.
      await expect
        .poll(async () => {
          const files = await fs.readdir(MAIL_DIR).catch(() => []);
          const contents = await Promise.all(
            files.map((file) => fs.readFile(path.join(MAIL_DIR, file), 'utf8')),
          );
          return contents.some(
            (text) => text.includes(name) && text.includes('To: inbox@example.test'),
          );
        })
        .toBe(true);

      // The webhook got the JSON body with a valid HMAC signature.
      await expect.poll(() => received.some((item) => item.body.includes(name))).toBe(true);
      const hook = received.find((item) => item.body.includes(name));
      const expected = `sha256=${createHmac('sha256', E2E_ENV.FORMS_WEBHOOK_SECRET)
        .update(hook?.body ?? '')
        .digest('hex')}`;
      expect(hook?.headers['x-signature']).toBe(expected);
    } finally {
      server.close();
    }
  });

  test('a failed delivery is kept as failed and retried by the maintenance job', async ({
    browser,
    page,
  }) => {
    await login(page, E2E_ADMIN);
    await configureDelivery(page, { email: false, webhook: true });

    // Nothing listens on the webhook port: the delivery fails, the submission is kept.
    const { context, page: guest } = await visitor(browser);
    const name = `Retry ${stamp}`;
    await openContact(guest);
    await fill(guest, valid(name));
    await submit(guest);
    await expect(guest.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
    await context.close();
    await page.goto(`/admin/pages/forms/contact?status=all&q=${encodeURIComponent(name)}`);
    await expect(page.getByText('webhook: failed')).toBeVisible();

    const received: Received[] = [];
    const server = await startWebhookServer(received);
    try {
      const cron = await page.request.get('/api/cron/maintenance', {
        headers: { authorization: `Bearer ${E2E_ENV.CRON_SECRET}` },
      });
      expect(cron.status()).toBe(200);
      expect(received.some((item) => item.body.includes(name))).toBe(true);
      await page.reload();
      await expect(page.getByText('webhook: sent')).toBeVisible();
    } finally {
      server.close();
      await configureDelivery(page, { email: false, webhook: false });
    }
  });

  test('managers can read and export but not delete or change form settings', async ({
    browser,
  }) => {
    // Capture an admin's delete request…
    const admin = await browser.newContext();
    const adminPage = await admin.newPage();
    await login(adminPage, E2E_ADMIN);
    await adminPage.goto(
      `/admin/pages/forms/contact?status=all&q=${encodeURIComponent(`NoJS ${stamp}`)}`,
    );
    await adminPage.getByRole('table', { name: 'Submissions' }).getByRole('link').first().click();
    await expect(adminPage.getByRole('button', { name: 'Delete' })).toBeVisible();
    await adminPage.getByRole('button', { name: 'Delete' }).click();
    const [deleteRequest] = await Promise.all([
      adminPage.waitForRequest(
        (req) => req.method() === 'POST' && Boolean(req.headers()['next-action']),
      ),
      adminPage.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click(),
    ]);
    await expect(adminPage.getByText('Submission deleted.')).toBeVisible();
    await admin.close();

    const manager = await browser.newContext();
    const page = await manager.newPage();
    await login(page, E2E_MANAGER);
    await page.goto('/admin/pages/forms/contact?status=all');
    await page.getByRole('table', { name: 'Submissions' }).getByRole('link').first().click();
    await expect(page.getByRole('button', { name: /Mark as/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);

    const csv = await page.request.get('/api/forms/export?form=contact&status=all');
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toContain('text/csv');
    expect(await csv.text()).toContain('Received');

    // …and replay it with the manager's session: rejected on the server.
    const replay = await page.request.post(deleteRequest.url(), {
      headers: {
        'next-action': deleteRequest.headers()['next-action'] ?? '',
        'content-type': deleteRequest.headers()['content-type'] ?? 'text/plain;charset=UTF-8',
        accept: 'text/x-component',
        origin: new URL(deleteRequest.url()).origin,
      },
      data: deleteRequest.postData() ?? '',
    });
    expect(await replay.text()).toContain('You are not allowed to perform this action.');

    await page.goto('/admin/settings');
    await expect(page.locator('form[aria-label="Forms"]')).toHaveCount(0);
    await manager.close();
  });
});
