import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import path from 'node:path';

/**
 * Variables that change what a script does on a deploy or in CI (`CI=true` on
 * GitHub Actions, the platform's deploy variables) or which database it opens.
 * Script tests start from an environment without them, so they behave the same
 * on a laptop and in CI; a test that needs one passes it explicitly.
 */
const DEPLOY_VARIABLES = [
  'CI',
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_GIT_COMMIT_REF',
  'NETLIFY',
  'CONTEXT',
  'BRANCH',
  'DEPLOYMENT_ENVIRONMENT',
  'DATABASE_URL',
  'DIRECT_URL',
  'NODE_OPTIONS',
] as const;

export function scriptEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of DEPLOY_VARIABLES) delete env[name];
  return { ...env, ...extra };
}

export const SCRIPT_TIMEOUT_MS = 120_000;

/** Runs `scripts/<file>` like `pnpm <script>` does (tsx, react-server conditions). */
export function runScriptFile(
  file: string,
  args: readonly string[],
  extra: Record<string, string> = {},
): SpawnSyncReturns<string> {
  return spawnSync(
    process.execPath,
    [path.resolve('node_modules/tsx/dist/cli.mjs'), '--conditions=react-server', file, ...args],
    { env: scriptEnv(extra), encoding: 'utf8', timeout: SCRIPT_TIMEOUT_MS },
  );
}
