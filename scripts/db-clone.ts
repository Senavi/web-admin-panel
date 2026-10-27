/**
 * `pnpm db:clone --from <url> --to <url> [--media-from <public url>] [--yes]`:
 * refresh a STAGING database from production (Supabase / R2 setups; on Neon use
 * "Reset from parent" on the staging branch instead, docs/DEPLOYMENT.md).
 *
 * Migrates the target, replaces its content with the source's (users, settings,
 * content, media rows, requests) and, with `--media-from` (the production bucket's
 * public URL), copies the files into this environment's storage (S3_* / Supabase
 * variables of the staging setup). Without it, set STORAGE_READ_FALLBACK_URL on
 * staging. Refuses in deploys/CI, onto the source itself, or onto this setup's
 * production database; asks for confirmation.
 */
import './lib/load-env';

import { cloneDatabase, copyMediaFromUrl } from '@/core/database/clone';
import { cloneRefusal } from '@/core/database/clone-guard';
import { maskConnectionString, migrationUrl } from '@/core/db/connection-info';
import { migratePostgres, openPostgres } from '@/core/db/drivers/postgres';
import { getStorage } from '@/core/storage';

import { ask, parseFlags } from './lib/prompt';

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2));
  const refusal = cloneRefusal({ from: flags.from, to: flags.to, env: process.env });
  if (refusal) {
    console.error(refusal);
    return 1;
  }
  const from = flags.from ?? '';
  const to = flags.to ?? '';
  if (flags.yes !== 'true') {
    if (!process.stdin.isTTY) {
      console.error('Not a terminal: add --yes to confirm.');
      return 1;
    }
    const answer = await ask(
      `Replace ALL content of ${maskConnectionString(to)}\nwith the content of ${maskConnectionString(from)}? Type "clone" to continue`,
    );
    if (answer !== 'clone') {
      console.info('Nothing was changed.');
      return 1;
    }
  }
  const target = migrationUrl({ DATABASE_URL: to }) ?? to;
  console.info(`[clone] migrating ${maskConnectionString(target)}…`);
  await migratePostgres(target);
  const source = openPostgres(migrationUrl({ DATABASE_URL: from }) ?? from, { max: 1 });
  const destination = openPostgres(target, { max: 1 });
  try {
    const rows = await cloneDatabase(source.db, destination.db);
    const total = Object.values(rows).reduce((sum, count) => sum + count, 0);
    console.info(`[clone] ${total} rows copied (${Object.keys(rows).length} tables).`);
    if (flags['media-from']) {
      const files = await copyMediaFromUrl(destination.db, flags['media-from'], getStorage());
      console.info(`[clone] ${files.copied} files copied, ${files.missing} missing at the source.`);
    } else {
      console.info(
        '[clone] Files were not copied: set STORAGE_READ_FALLBACK_URL on staging (production bucket URL), or rerun with --media-from <url>.',
      );
    }
    console.info(
      '[clone] Done. Integration keys (email, analytics…) must be re-entered on staging: they are encrypted with production’s AUTH_SECRET.',
    );
    return 0;
  } finally {
    await source.close();
    await destination.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
