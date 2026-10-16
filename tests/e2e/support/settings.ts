import { expect, type Page, request } from '@playwright/test';
import { ADMIN } from './admin';

export interface StatusChange {
  readonly maintenance?: boolean;
  readonly privateMode?: boolean;
  readonly indexing?: boolean;
}

/** Settings tab (`?tab=`), switch label and confirmation button of each status switch. */
const SWITCHES: Record<
  keyof StatusChange,
  { tab: string; form: string; label: string; confirm: string }
> = {
  maintenance: {
    tab: 'access',
    form: 'Site access',
    label: 'Pause the site',
    confirm: 'Pause the site',
  },
  privateMode: {
    tab: 'access',
    form: 'Site access',
    label: 'Private site',
    confirm: 'Make private',
  },
  indexing: {
    tab: 'search',
    form: 'Google & sharing',
    label: 'Show the site in Google',
    confirm: 'Hide from Google',
  },
};

/** Opens a Settings tab and returns its (hydrated) form. */
export async function openSettingsTab(page: Page, tab: string, label: string) {
  await page.goto(`${ADMIN}/settings?tab=${tab}`);
  const form = page.locator(`form[aria-label="${label}"][data-hydrated]`);
  await expect(form).toBeVisible();
  return form;
}

/** Saves a dirty Settings tab (sticky bar) and confirms dialogs for "dangerous" changes. */
export async function saveSettingsTab(page: Page, confirmations: readonly string[] = []) {
  await page
    .getByRole('region', { name: 'Unsaved changes' })
    .getByRole('button', { name: 'Save changes' })
    .click();
  const dialog = page.getByRole('alertdialog');
  for (const confirm of confirmations) {
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: confirm }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.getByText('Settings saved.').last()).toBeVisible();
}

/** Changes the site status switches through the UI (as a signed-in admin), one tab at a time. */
export async function updateSiteStatus(page: Page, change: StatusChange): Promise<void> {
  const byTab = new Map<string, Array<[keyof StatusChange, boolean]>>();
  for (const [key, value] of Object.entries(change) as Array<[keyof StatusChange, boolean]>) {
    const tab = SWITCHES[key].tab;
    byTab.set(tab, [...(byTab.get(tab) ?? []), [key, value]]);
  }
  for (const entries of byTab.values()) {
    const first = SWITCHES[entries[0]?.[0] ?? 'maintenance'];
    const form = await openSettingsTab(page, first.tab, first.form);
    const confirmations: string[] = [];
    let changed = false;
    for (const [key, value] of entries) {
      const toggle = form.getByRole('switch', { name: SWITCHES[key].label });
      if ((await toggle.getAttribute('aria-checked')) === String(value)) continue;
      await toggle.click();
      changed = true;
      // Turning something "dangerous" on asks for confirmation.
      if (key === 'indexing' ? value === false : value === true)
        confirmations.push(SWITCHES[key].confirm);
    }
    if (changed) await saveSettingsTab(page, confirmations);
  }
}

/** Plain HTTP GET as an anonymous browser-like client (no cookies). */
export const VISITOR_HEADERS = { 'user-agent': 'Mozilla/5.0 Chrome/150', 'accept-language': 'en' };

/** The proxy caches site state for a few seconds: wait until visitors see the public site again. */
export async function waitForPublicSite(baseURL: string | undefined): Promise<void> {
  const context = await request.newContext({ baseURL, extraHTTPHeaders: VISITOR_HEADERS });
  await expect
    .poll(async () => (await context.get('/about', { maxRedirects: 0 })).status(), {
      timeout: 15_000,
    })
    .toBe(200);
  await context.dispose();
}

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', uk: 'Ukrainian' };

/** Publishes exactly these demo locales in Settings → General (the main language `en` stays). */
export async function setEnabledLocales(page: Page, locales: readonly string[]): Promise<void> {
  const form = await openSettingsTab(page, 'general', 'General');
  let changed = false;
  for (const code of ['uk']) {
    const row = form.locator(`li[data-language="${code}"]`);
    const published = (await row.getAttribute('data-state')) === 'published';
    if (locales.includes(code) === published) continue;
    changed = true;
    if (published) {
      await row.getByRole('button', { name: 'Unpublish' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Unpublish' }).click();
    } else {
      if ((await row.count()) === 0) {
        await form.getByLabel('Add a language').fill(LANGUAGE_NAMES[code] ?? code);
        await form
          .getByRole('list', { name: 'Languages found' })
          .getByRole('button')
          .first()
          .click();
      }
      await row.getByRole('button', { name: 'Publish language' }).click();
    }
  }
  if (changed) await saveSettingsTab(page);
}
