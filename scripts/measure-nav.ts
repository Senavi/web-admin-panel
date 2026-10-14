/**
 * Measures client-side navigation speed: click a link → the new page's final
 * content is visible (URL changed, new <h1>, no loading skeletons).
 *
 *   pnpm measure:nav [--base http://localhost:3000] [--rounds 2] [--pause 600]
 *
 * Signs in with ADMIN_EMAIL / ADMIN_PASSWORD, or the development admin from
 * `.data/dev-admin-credentials.txt` (local database only). Prints one table per
 * round (round 1 on a fresh `pnpm dev` = first visits, later rounds = repeat).
 */
import fs from 'node:fs';

import { chromium } from '@playwright/test';

import { projectConfig } from '../project.config';
import {
  ADMIN_ROUTE_SEQUENCE,
  measureNavigation,
  type NavigationTiming,
  SITE_ROUTE_SEQUENCE,
} from '../tests/e2e/support/navigation';

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
};
const BASE = flag('base', 'http://localhost:3000').replace(/\/$/, '');
const ROUNDS = Number(flag('rounds', '2'));
/** Idle time before each click (people don't click every few milliseconds). */
const PAUSE_MS = Number(flag('pause', '600'));
const ADMIN = projectConfig.adminPath;

function credentials(): { email: string; password: string } {
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD)
    return { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };
  const text = fs.readFileSync('.data/dev-admin-credentials.txt', 'utf8');
  const email = /email:\s*(\S+)/.exec(text)?.[1];
  const password = /password:\s*(\S+)/.exec(text)?.[1];
  if (!email || !password)
    throw new Error('No admin credentials (set ADMIN_EMAIL/ADMIN_PASSWORD).');
  return { email, password };
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const { email, password } = credentials();
  await page.goto(`${BASE}${ADMIN}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 60_000 });

  for (let round = 1; round <= ROUNDS; round += 1) {
    const rows: Array<[string, NavigationTiming]> = [];
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    for (const path of SITE_ROUTE_SEQUENCE) {
      await page.waitForTimeout(PAUSE_MS);
      rows.push([path, await measureNavigation(page, path)]);
    }
    await page.goto(`${BASE}${ADMIN}`);
    await page.waitForLoadState('networkidle');
    for (const path of ADMIN_ROUTE_SEQUENCE) {
      const href = `${ADMIN}${path}`;
      await page.waitForTimeout(PAUSE_MS);
      rows.push([href, await measureNavigation(page, href)]);
    }
    console.info(`\nRound ${round} (${BASE})`);
    console.info(`  ${'page'.padEnd(28)} ${'feedback'.padStart(9)} ${'content'.padStart(9)}`);
    for (const [path, { feedbackMs, contentMs }] of rows)
      console.info(
        `  ${path.padEnd(28)} ${`${feedbackMs} ms`.padStart(9)} ${`${contentMs} ms`.padStart(9)}`,
      );
  }
  await browser.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
