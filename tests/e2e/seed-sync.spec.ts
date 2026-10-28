import { spawnSync } from 'node:child_process';

import { type Page } from '@playwright/test';
import postgres from 'postgres';

import { registry } from '@/content';
import type { AnyCollection } from '@/core/content/collection';
import type { AnyPage } from '@/core/content/define';
import type { AnyField } from '@/core/content/fields';
import { seedValueHash } from '@/core/content/seed-provenance';
import { projectConfig } from '@project/config';

import { admin } from './support/admin';
import { login } from './support/auth';
import { expect, test } from './support/test';
import { E2E_ADMIN, E2E_MANAGER } from './support/users';

const LOCALE = projectConfig.defaultLocale;
const TEXT_KINDS: ReadonlySet<string> = new Set(['text', 'textarea']);

/**
 * The first page whose first section has two seeded text fields (the demo's home
 * hero, a project's own home after `pnpm demo:remove`): one is left to follow the
 * code, the other is "edited by the client".
 */
function seedTarget() {
  const pages: readonly AnyPage[] = registry.pages;
  for (const page of pages) {
    const section = page.sections[0];
    const seed = (
      page.seed as Record<string, Record<string, Record<string, unknown>>> | undefined
    )?.[LOCALE]?.[section?.id ?? ''];
    if (!section || !seed) continue;
    const fields = Object.entries(section.fields as Record<string, AnyField>).filter(
      ([key, field]) => TEXT_KINDS.has(field.kind) && typeof seed[key] === 'string',
    );
    const [followed, edited] = fields;
    if (followed && edited)
      return {
        page,
        section,
        followed: { key: followed[0], field: followed[1], seed: String(seed[followed[0]]) },
        edited: { key: edited[0], field: edited[1], seed: String(seed[edited[0]]) },
        other: page.sections[1],
      };
  }
  throw new Error('seed-sync: no page has a first section with two seeded text fields.');
}

const target = seedTarget();
const PAGE_ID = target.page.id;
const SECTION_ID = target.section.id;
const CLIENT_TEXT = 'Written by the client';

const followedBox = (page: Page) =>
  page.getByRole('textbox', { name: target.followed.field.label }).first();
const editedBox = (page: Page) =>
  page.getByRole('textbox', { name: target.edited.field.label }).first();

async function openEditor(page: Page): Promise<void> {
  await page.goto(admin(`/pages/${PAGE_ID}`));
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
      const [row] = await sql<Array<{ data: Record<string, postgres.JSONValue> }>>`
        select data from page_content where page_id = ${PAGE_ID} and locale = ${LOCALE}`;
      const data = {
        ...row!.data,
        [SECTION_ID]: {
          ...(row!.data[SECTION_ID] as Record<string, postgres.JSONValue>),
          [target.followed.key]: 'Old seed text',
          [target.edited.key]: CLIENT_TEXT,
        },
      };
      await sql`update page_content set data = ${sql.json(data)}, version = version + 1
        where page_id = ${PAGE_ID} and locale = ${LOCALE}`;
      const hashes = {
        [`${SECTION_ID}.${target.followed.key}`]: seedValueHash(
          target.followed.field,
          'Old seed text',
        ),
        [`${SECTION_ID}.${target.edited.key}`]: seedValueHash(target.edited.field, 'Old seed edit'),
      };
      await sql`update content_seed_state set hashes = hashes || ${sql.json(hashes)}
        where scope = 'page' and document_key = ${PAGE_ID} and locale = ${LOCALE}`;
    } finally {
      await sql.end();
    }

    const sync = spawnSync('pnpm', ['content:sync'], { encoding: 'utf8', env: process.env });
    expect(sync.status, sync.stderr).toBe(0);
    expect(sync.stdout).toContain('updated from code: 1');
    expect(sync.stdout).toContain(`${PAGE_ID}:${LOCALE}:${SECTION_ID}.${target.followed.key}`);

    await login(page, E2E_ADMIN);
    await openEditor(page);
    await expect(followedBox(page)).toHaveValue(target.followed.seed);
    await expect(editedBox(page)).toHaveValue(CLIENT_TEXT);
    // The update is a system revision that can be undone.
    await page.getByRole('button', { name: 'History' }).click();
    const revisions = page.getByRole('list', { name: 'Revisions' });
    await expect(revisions).toContainText('Update from code');
    await expect(revisions).toContainText('Before update from code');
  });

  test('Reset to code defaults, then undo it from the history', async ({ page }) => {
    await login(page, E2E_MANAGER);
    await openEditor(page);
    await expect(editedBox(page)).toHaveValue(CLIENT_TEXT);

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Reset to code defaults…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reset to code defaults' });
    await dialog.getByRole('combobox', { name: 'What to reset' }).click();
    await page.getByRole('option', { name: target.section.label, exact: true }).click();
    await expect(dialog.getByRole('list', { name: 'Fields that will change' })).toHaveText(
      `${target.section.label}: ${target.edited.field.label}`,
    );
    await dialog.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByText('Reset to the code defaults.')).toBeVisible();
    await expect(editedBox(page)).toHaveValue(target.edited.seed);
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
    await expect(editedBox(page)).toHaveValue(CLIENT_TEXT);
    await expect(followedBox(page)).toHaveValue(target.followed.seed);

    // Nothing left to reset in a section that matches the code.
    if (!target.other) return;
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Reset to code defaults…' }).click();
    await dialog.getByRole('combobox', { name: 'What to reset' }).click();
    await page.getByRole('option', { name: target.other.label, exact: true }).click();
    await expect(dialog.getByText('Nothing to reset')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Reset', exact: true })).toBeDisabled();
  });
});

test('collection items people created have no code defaults', async ({ page }) => {
  const collections: readonly AnyCollection[] = registry.collections;
  const collection = collections[0];
  test.skip(!collection, 'The project has no collection.');
  await login(page, E2E_ADMIN);
  await page.goto(admin(`/pages/collections/${collection!.id}`));
  await page.getByRole('button', { name: `New ${collection!.itemLabel.toLowerCase()}` }).click();
  await expect(page.locator('form[data-hydrated]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'More actions' })).toHaveCount(0);
});
