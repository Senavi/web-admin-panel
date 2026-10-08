import { expect, type Page } from '@playwright/test';

export interface StatusChange {
  readonly maintenance?: boolean;
  readonly privateMode?: boolean;
  readonly indexing?: boolean;
}

const SWITCHES: Record<keyof StatusChange, { label: string; confirm: string }> = {
  maintenance: { label: 'Maintenance mode', confirm: 'Turn on' },
  privateMode: { label: 'Private mode', confirm: 'Make private' },
  indexing: { label: 'Search engine indexing', confirm: 'Stop indexing' },
};

/** Changes Settings → Site status through the UI (as a signed-in admin). */
export async function updateSiteStatus(page: Page, change: StatusChange): Promise<void> {
  await page.goto('/admin/settings');
  const form = page.locator('form[aria-label="Site status"][data-hydrated]');
  await expect(form).toBeVisible();
  for (const [key, value] of Object.entries(change) as Array<[keyof StatusChange, boolean]>) {
    const toggle = form.getByRole('switch', { name: SWITCHES[key].label });
    if ((await toggle.getAttribute('aria-checked')) !== String(value)) await toggle.click();
  }
  await form.getByRole('button', { name: 'Save' }).click();
  // Turning something "dangerous" on asks for confirmation (one dialog per change).
  const dialog = page.getByRole('alertdialog');
  const confirmations = (Object.entries(change) as Array<[keyof StatusChange, boolean]>).filter(
    ([key, value]) => (key === 'indexing' ? value === false : value === true),
  );
  for (const [key] of confirmations) {
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: SWITCHES[key].confirm }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.getByText('Settings saved.').last()).toBeVisible();
}

/** Plain HTTP GET as an anonymous browser-like client (no cookies). */
export const VISITOR_HEADERS = { 'user-agent': 'Mozilla/5.0 Chrome/150', 'accept-language': 'en' };
