/**
 * `pnpm db:clone --from <url> --to <url> [--media-from <public url>] [--allow-any-source] [--yes]`:
 * refresh a STAGING database from production (Supabase / R2 setups; on Neon use
 * "Reset from parent" on the staging branch instead, docs/DEPLOYMENT.md).
 *
 * Safety (D-098): reads both databases first and refuses before writing anything
 * when the source isn't a migrated live site (marked production, or
 * `--allow-any-source`), when the target is marked production (no flag overrides
 * that), or when it is unmarked but not empty. Also refuses in deploys/CI, onto the
 * source itself, or onto this setup's production database. Then asks for
 * confirmation, migrates the target and replaces its content (users, settings,
 * content, media rows, requests) in ONE transaction, so a failure leaves it as it
 * was. With `--media-from` (the production bucket's public URL) it then copies the
 * files into this environment's storage (S3_* / Supabase variables of the staging
 * setup). Without it, set STORAGE_READ_FALLBACK_URL on staging.
 */
import './lib/load-env';

import {
  cloneDatabase,
  copyMediaFromUrl,
  expectedMigrations,
  inspectCloneDatabase,
} from '@/core/database/clone';
import {
  cloneRefusal,
  describeCloneTarget,
  sourceRefusal,
  targetRefusal,
} from '@/core/database/clone-guard';
import { describeRemoteContent } from '@/core/database/remote-summary';
import { databaseIdentity, maskConnectionString, migrationUrl } from '@/core/db/connection-info';
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
  const from = migrationUrl({ DATABASE_URL: flags.from }) ?? flags.from ?? '';
  const to = migrationUrl({ DATABASE_URL: flags.to }) ?? flags.to ?? '';
  const source = openPostgres(from, { max: 1 });
  const destination = openPostgres(to, { max: 1 });
  try {
    // 1. Read both databases; refuse before anything is written (D-098).
    const sourceState = await inspectCloneDatabase(source.db);
    const sourceProblem = sourceRefusal(sourceState, {
      expectedMigrations: expectedMigrations(),
      allowAnySource: flags['allow-any-source'] === 'true',
    });
    if (sourceProblem) {
      console.error(sourceProblem);
      return 1;
    }
    const targetState = await inspectCloneDatabase(destination.db);
    const targetProblem = targetRefusal(targetState);
    if (targetProblem) {
      console.error(targetProblem);
      return 1;
    }

    // 2. Confirm with what each database is and what will be lost.
    const summary = [
      `From ${sourceState.marker ?? 'unmarked'} ${maskConnectionString(from)}`,
      `  (${describeRemoteContent(sourceState.summary)})`,
      `Into ${maskConnectionString(to)}`,
      `  ${describeCloneTarget(targetState)}.`,
    ].join('\n');
    console.info(summary);
    if (flags.yes !== 'true') {
      if (!process.stdin.isTTY) {
        console.error('Not a terminal: add --yes to confirm.');
        return 1;
      }
      const answer = await ask('Type "clone" to continue');
      if (answer !== 'clone') {
        console.info('Nothing was changed.');
        return 1;
      }
    }

    // 3. Migrate the target, then truncate + copy in one transaction (rolls back on any error).
    console.info(`[clone] migrating ${maskConnectionString(to)}…`);
    await migratePostgres(to);
    const rows = await cloneDatabase(source.db, destination.db, {
      targetIdentity: databaseIdentity(to),
    });
    const total = Object.values(rows).reduce((sum, count) => sum + count, 0);
    console.info(
      `[clone] ${total} rows copied (${Object.keys(rows).length} tables); target marked staging.`,
    );

    // 4. Files only after the commit.
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
