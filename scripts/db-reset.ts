/**
 * `pnpm db:reset [--yes]`: start the LOCAL database over from the code.
 *
 * Deletes the local PGlite data (`.data/pglite`), uploaded files (`.data/uploads`)
 * and dev emails (`.data/mail`) after a confirmation (`--yes` skips it), then
 * migrates, seeds the content from the code and prints the new development admin.
 *
 * Refuses with NODE_ENV=production or when DATABASE_URL/DIRECT_URL is set (an
 * online database is never reset), and while `pnpm dev` holds the database.
 */
import './lib/load-env';

import fs from 'node:fs';
import { createInterface } from 'node:readline/promises';

import { DEV_CREDENTIALS_FILE } from '@/core/auth/server/seed-admin';
import { findLocalServerUrl } from '@/core/db/drivers/local-server-info';
import { openPglite } from '@/core/db/drivers/pglite';
import {
  DATA_DIR,
  MAIL_DIR,
  PGLITE_DIR,
  PGLITE_LOCK_FILE,
  PGLITE_SERVER_FILE,
  UPLOADS_DIR,
} from '@/core/db/paths';
import { resetRefusal } from '@/core/db/reset-guard';
import { runSeed } from '@/core/db/seed';

const YES = process.argv.includes('--yes') || process.argv.includes('-y');
const relative = (dir: string) => dir.replace(`${process.cwd()}/`, '');

/** Process that holds the PGlite database (the dev server), if it is alive. */
function lockHolder(): number | null {
  if (findLocalServerUrl()) {
    try {
      return (JSON.parse(fs.readFileSync(PGLITE_SERVER_FILE, 'utf8')) as { pid: number }).pid;
    } catch {
      return -1;
    }
  }
  try {
    const pid = Number(fs.readFileSync(PGLITE_LOCK_FILE, 'utf8'));
    if (!pid || pid === process.pid) return null;
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

async function confirm(targets: readonly string[]): Promise<boolean> {
  if (YES) return true;
  if (!process.stdin.isTTY) {
    console.error('Not a terminal: run `pnpm db:reset --yes` to confirm.');
    return false;
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(
    `This deletes your local content, users, images and emails:\n${targets
      .map((target) => `  - ${target}`)
      .join('\n')}\nThe content is then filled again from the code. Continue? [y/N] `,
  );
  prompt.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function main(): Promise<number> {
  const refusal = resetRefusal(process.env);
  if (refusal) {
    console.error(refusal);
    return 1;
  }
  const holder = lockHolder();
  if (holder !== null) {
    console.error(
      `The local database is in use${holder > 0 ? ` by process ${holder}` : ''} (usually \`pnpm dev\` or \`pnpm preview\`). Stop it first, then run \`pnpm db:reset\` again.`,
    );
    return 1;
  }
  const targets = [PGLITE_DIR, UPLOADS_DIR, MAIL_DIR].map(relative);
  if (!(await confirm(targets))) {
    console.info('Nothing was deleted.');
    return 1;
  }
  for (const dir of [PGLITE_DIR, UPLOADS_DIR, MAIL_DIR, DEV_CREDENTIALS_FILE, PGLITE_LOCK_FILE])
    fs.rmSync(dir, { recursive: true, force: true });

  // Opening PGlite applies the migrations; the seed fills settings, content and the dev admin.
  const { db, client } = await openPglite();
  try {
    await runSeed(db, { seedDevAdmin: true });
  } finally {
    await client.close();
  }
  console.info(`\nLocal database reset (${relative(DATA_DIR)}): content filled from the code.`);
  if (fs.existsSync(DEV_CREDENTIALS_FILE)) {
    console.info(`\n${fs.readFileSync(DEV_CREDENTIALS_FILE, 'utf8').trim()}`);
    console.info(`(also in ${relative(DEV_CREDENTIALS_FILE)})`);
  } else if (process.env.SEED_ADMIN_EMAIL) {
    console.info(
      `Admin: ${process.env.SEED_ADMIN_EMAIL} (password from SEED_ADMIN_PASSWORD in .env).`,
    );
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
