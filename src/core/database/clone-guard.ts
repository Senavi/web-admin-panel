import { databaseIdentity, maskConnectionString } from '@/core/db/connection-info';
import { DeploymentEnvironment } from '@/core/deployment/environment';

import {
  describeRemoteContent,
  hasRemoteContent,
  type RemoteContentSummary,
} from './remote-summary';

/**
 * Safety checks of `pnpm db:clone` (pure; unit-tested): it overwrites the target
 * database, so it refuses anything that could destroy the live site. The URL checks
 * run before connecting; the marker checks (D-098) on what each database says it is,
 * whatever this computer's env says.
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

/** What `db:clone` reads from each database before touching anything (D-098). */
export interface CloneDatabaseState {
  /** `database_environment` marker, null when unmarked (or not migrated yet). */
  readonly marker: string | null;
  /** Migrations recorded in the database. */
  readonly migrations: number;
  /** Copied tables that don't exist. */
  readonly missingTables: readonly string[];
  readonly hasSettings: boolean;
  readonly summary: RemoteContentSummary;
}

/** Why the source can't be cloned, or null. `expectedMigrations`: the migrations of this code. */
export function sourceRefusal(
  state: CloneDatabaseState,
  options: { readonly expectedMigrations: number; readonly allowAnySource: boolean },
): string | null {
  if (state.migrations < options.expectedMigrations || state.missingTables.length > 0)
    return `The source database is not migrated (${state.migrations}/${options.expectedMigrations} migrations${
      state.missingTables.length ? `, missing tables: ${state.missingTables.join(', ')}` : ''
    }). Deploy production first, or check --from. Nothing was changed.`;
  if (state.summary.users === 0 || !state.hasSettings)
    return 'The source database has no users or no settings: it is empty or not the live site. Check --from. Nothing was changed.';
  if (state.marker !== DeploymentEnvironment.Production && !options.allowAnySource)
    return `The source database is marked ${state.marker ?? '"unknown"'}, not production. Clone from the live site's database (its first deploy with v1.8.1 marks it), or add --allow-any-source. Nothing was changed.`;
  return null;
}

/** Why the target must not be overwritten, or null. No flag overrides this. */
export function targetRefusal(state: CloneDatabaseState): string | null {
  if (state.marker === DeploymentEnvironment.Production)
    return "This is the live site's database (marked production). db:clone never overwrites it: clone INTO the staging database. (A restored copy of production: deploy the staging branch on it once, it re-marks its own database as staging.) Nothing was changed.";
  if (state.marker === DeploymentEnvironment.Staging) return null;
  if (state.marker !== null)
    return `The target database is marked ${state.marker}, not staging. Nothing was changed.`;
  return hasRemoteContent(state.summary)
    ? `The target database is not marked as staging and already holds ${describeRemoteContent(state.summary)}. Deploy the staging branch once (it marks its database), then rerun. Nothing was changed.`
    : null;
}

/** Confirmation line: "staging: 3 users, 24 content rows and 12 images will be replaced". */
export function describeCloneTarget(state: CloneDatabaseState): string {
  const label = state.marker ?? 'new database';
  return hasRemoteContent(state.summary)
    ? `${label}: ${describeRemoteContent(state.summary)} will be replaced`
    : `${label}: empty, nothing to replace`;
}
