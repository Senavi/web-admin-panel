import { databaseIdentity, maskConnectionString } from '@/core/db/connection-info';

/**
 * Safety checks of `pnpm db:clone` (pure; unit-tested): it overwrites the target
 * database, so it refuses anything that could destroy the live site.
 */
export interface CloneRequest {
  readonly from: string | undefined;
  readonly to: string | undefined;
  /** This machine's env: the production database of the current setup is never a target. */
  readonly env: Readonly<Record<string, string | undefined>>;
}

/** Why the clone must not run, or null when it may. */
export function cloneRefusal({ from, to, env }: CloneRequest): string | null {
  if (env.VERCEL_ENV || env.NETLIFY === 'true' || env.CI === 'true')
    return 'Refusing to clone during a deploy or in CI: run `pnpm db:clone` on your computer.';
  if (!from || !to) return 'Usage: pnpm db:clone --from <source url> --to <target url> [--yes]';
  const source = databaseIdentity(from);
  const target = databaseIdentity(to);
  if (!source || !target) return 'Both --from and --to must be postgres:// connection strings.';
  if (source === target)
    return `Refusing to clone a database onto itself (${maskConnectionString(to)}).`;
  for (const name of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    const configured = env[name];
    if (
      configured &&
      env.DEPLOYMENT_ENVIRONMENT !== 'staging' &&
      databaseIdentity(configured) === target
    )
      return `Refusing to overwrite ${maskConnectionString(to)}: it is this setup's ${name} (production unless DEPLOYMENT_ENVIRONMENT=staging). Clone into the staging database only.`;
  }
  return null;
}
