/**
 * Build-time database step for Vercel / Netlify (`pnpm db:migrate:deploy && pnpm build`).
 * Without DATABASE_URL it skips (the site deploys in preview mode). Otherwise it
 * runs only for production deploys (or previews with an isolated database):
 * migrations, then `db:prepare` (RLS, media bucket, missing settings/content).
 */
import { spawnSync } from 'node:child_process';

import { migrationDecision } from '@/core/db/deploy-context';

const decision = migrationDecision(process.env);
console.info(`[migrate] ${decision.migrate ? 'running' : 'skipping'}: ${decision.reason}`);
if (decision.migrate) {
  for (const script of ['db:migrate', 'db:prepare']) {
    const result = spawnSync('pnpm', [script], { stdio: 'inherit', env: process.env });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
