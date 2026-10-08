/**
 * Build-time migrations for Vercel / Netlify (`pnpm db:migrate:deploy && pnpm build`).
 * Runs only for production deploys (or previews with an isolated database).
 */
import { spawnSync } from 'node:child_process';

import { migrationDecision } from '@/core/db/deploy-context';

const decision = migrationDecision(process.env);
console.info(`[migrate] ${decision.migrate ? 'running' : 'skipping'}: ${decision.reason}`);
if (decision.migrate) {
  const result = spawnSync('pnpm', ['db:migrate'], { stdio: 'inherit', env: process.env });
  process.exit(result.status ?? 1);
}
