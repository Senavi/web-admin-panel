/**
 * Build-time database step for Vercel / Netlify (`pnpm db:migrate:deploy && pnpm build`).
 * Without DATABASE_URL it skips (the site deploys in preview mode). Otherwise it runs
 * for production deploys, and for staging/previews with an isolated database
 * (`migrationDecision`, D-097): migrations, then `db:prepare` (RLS and bucket on
 * Supabase, missing settings/content). Both run under a Postgres advisory lock taken
 * over the direct connection, so two deploys of one database never overlap.
 */
import './lib/load-env';

import { spawnSync } from 'node:child_process';

import { migrationUrl, maskConnectionString } from '@/core/db/connection-info';
import { migrationDecision } from '@/core/db/deploy-context';
import {
  acquireLock,
  DEPLOY_LOCK_TIMEOUT_MS,
  releaseDeployLock,
  tryDeployLock,
} from '@/core/db/deploy-lock';
import { openSession } from '@/core/db/drivers/postgres';

import { projectConfig } from '../project.config';

async function main(): Promise<number> {
  const decision = migrationDecision(process.env, projectConfig.stagingBranch);
  console.info(`[migrate] ${decision.migrate ? 'running' : 'skipping'}: ${decision.reason}`);
  if (!decision.migrate) return 0;

  const url = migrationUrl({
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
  });
  if (!url) return 0;
  const session = openSession(url);
  try {
    const locked = await acquireLock(() => tryDeployLock(session), {
      onWait: () =>
        console.info(
          `[migrate] another deploy is migrating ${maskConnectionString(url)}; waiting (up to ${DEPLOY_LOCK_TIMEOUT_MS / 60000} min)…`,
        ),
    });
    if (!locked) {
      console.error('[migrate] timed out waiting for the other deploy; retry this deploy.');
      return 1;
    }
    for (const script of ['db:migrate', 'db:prepare']) {
      const result = spawnSync('pnpm', [script], { stdio: 'inherit', env: process.env });
      if (result.status !== 0) return result.status ?? 1;
    }
    await releaseDeployLock(session);
    return 0;
  } finally {
    // Ending the session releases the lock in any case.
    await session.end({ timeout: 5 });
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
