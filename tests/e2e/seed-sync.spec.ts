import { spawnSync } from 'node:child_process';

import { type Page } from '@playwright/test';
import postgres from 'postgres';

import { teamPage } from '@/content/pages/team';
import { seedValueHash } from '@/core/content/seed-provenance';

import { admin } from './support/admin';
import { login } from './support/auth';
import { expect, test } from './support/test';
import { E2E_ADMIN, E2E_MANAGER } from './support/users';

const SEED_TITLE = 'Our team';
const SEED_LEAD = 'Designers, engineers and writers who care about the details.';
const intro = teamPage.sections.find((section) => section.id === 'intro')!;

const titleBox = (page: Page) => page.getByRole('textbox', { name: 'Title' }).first();
const leadBox = (page: Page) => page.getByRole('textbox', { name: 'Lead' }).first();

async function openTeamEditor(page: Page): Promise<void> {
  await page.goto(admin('/pages/team'));
  await expect(page.locator('form[data-hydrated]')).toBeVisible();
}

/**
 * Untouched seed content follows the code (D-095). A seed change is simulated in
 * the database: the stored texts and their recorded seed hashes are set to what
 * an older version of the code would have left, then `content:sync` runs (what
 * `pnpm dev` and deploys run on start).
 */
test.describe.serial('seed content follows the code', () => {
  test.skip(!process.env.DATABASE_URL, 'Needs the e2e database (pnpm e2e:prod).');

  test('a changed seed updates untouched text and keeps edited text', async ({ page }) => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => undefined });
    try {
      const [row] = await sql<Array<{ data: Record<string, Record<string, unknown>> }>>`
        select data from page_content where page_id = 'team' and locale = 'en'`;
      const data = {
        ...row!.data,
        intro: { title: 'Old seed title', lead: 'Written by the client' },
      };
      await sql`update page_content set data = ${sql.json(data)}, version = version + 1
        where page_id = 'team' and locale = 'en'`;
      const hashes = {
        'intro.title': seedValueHash(intro.fields.title!, 'Old seed title'),
        'intro.lead': seedValueHash(intro.fields.lead!, 'Old seed lead'),
      };
      await sql`update content_seed_state set hashes = hashes || ${sql.json(hashes)}
        where scope = 'page' and document_key = 'team' and locale = 'en'`;
    } finally {
      await sql.end();
    }

    const sync = spawnSync('pnpm', ['content:sync'], { encoding: 'utf8', env: process.env });
    expect(sync.status, sync.stderr).toBe(0);
    expect(sync.stdout).toContain('updated from code: 1');
    expect(sync.stdout).toContain('team:en:intro.title');

    await login(page, E2E_ADMIN);
    await openTeamEditor(page);
    await expect(titleBox(page)).toHaveValue(SEED_TITLE);
    await expect(leadBox(page)).toHaveValue('Written by the client');
    // The update is a system revision that can be undone.
    await page.getByRole('button', { name: 'History' }).click();
    const revisions = page.getByRole('list', { name: 'Revisions' });
    await expect(revisions).toContainText('Update from code');
    await expect(revisions).toContainText('Before update from code');
  });

  test('Reset to code defaults, then undo it from the history', async ({ page }) => {
    await login(page, E2E_MANAGER);
    await openTeamEditor(page);
    await expect(leadBox(page)).toHaveValue('Written by the client');

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Reset to code defaults…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reset to code defaults' });
    await dialog.getByRole('combobox', { name: 'What to reset' }).click();
    await page.getByRole('option', { name: 'Intro', exact: true }).click();
    await expect(dialog.getByRole('list', { name: 'Fields that will change' })).toHaveText(
      'Intro: Lead',
    );
    await dialog.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByText('Reset to the code defaults.')).toBeVisible();
    await expect(leadBox(page)).toHaveValue(SEED_LEAD);
    await expect(page.getByText('Unsaved changes')).toHaveCount(0);

    // Restorable: the version before the reset is in the history.
    await page.getByRole('button', { name: 'History' }).click();
    const revisions = page.getByRole('list', { name: 'Revisions' }).getByRole('button');
    await revisions
      .filter({ hasText: 'Update from code' })
      .filter({ hasNotText: 'Before update from code' })
      .click();
    await page.getByRole('button', { name: 'Restore this version' }).click();
    await expect(page.getByText('Revision restored.')).toBeVisible();
    await expect(leadBox(page)).toHaveValue('Written by the client');
    await expect(titleBox(page)).toHaveValue(SEED_TITLE);

    // Nothing left to reset in a section that matches the code.
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Reset to code defaults…' }).click();
    await dialog.getByRole('combobox', { name: 'What to reset' }).click();
    await page.getByRole('option', { name: 'Team members', exact: true }).click();
    await expect(dialog.getByText('Nothing to reset')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Reset', exact: true })).toBeDisabled();
  });
});

test('collection items people created have no code defaults', async ({ page }) => {
  await login(page, E2E_ADMIN);
  await page.goto(admin('/pages/collections/blog'));
  await page.getByRole('button', { name: 'New post' }).click();
  await expect(page.locator('form[data-hydrated]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'More actions' })).toHaveCount(0);
});
