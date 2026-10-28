import { DeploymentEnvironment } from './environment';

/**
 * Does this site use the right database? (D-099) Compares the environment with the
 * database's marker (D-098). Pure: unit-tested; the server reads the marker once per
 * instance (`database-check-server.ts`). Only warns: saving is never blocked, so
 * people can keep working while DATABASE_URL is fixed.
 */
export const DatabaseMismatch = {
  /** A staging site on the live site's database: edits change the live site. */
  StagingOnLive: 'staging-on-live',
  /** The live site on the staging database. */
  LiveOnStaging: 'live-on-staging',
} as const;
export type DatabaseMismatch = (typeof DatabaseMismatch)[keyof typeof DatabaseMismatch];

export const DATABASE_MISMATCH_MESSAGES: Record<DatabaseMismatch, string> = {
  [DatabaseMismatch.StagingOnLive]:
    'This staging site is connected to the LIVE database. Changes here change the live site. Fix DATABASE_URL for the staging branch.',
  [DatabaseMismatch.LiveOnStaging]:
    'The live site is connected to the staging database. Fix DATABASE_URL for production.',
};

/**
 * `marker`: the database's marker (null: unmarked, before the first deploy with
 * v1.8.1). `identity`: `databaseIdentity()` of this site's DATABASE_URL. A marker
 * written for another database came along in a copy (Neon reset, backup): no warning.
 */
export function detectDatabaseMismatch(
  environment: DeploymentEnvironment,
  marker: { readonly environment: string; readonly identity: string | null } | null,
  identity: string | null,
): DatabaseMismatch | null {
  if (!marker) return null;
  if (marker.identity && identity && marker.identity !== identity) return null;
  if (
    environment === DeploymentEnvironment.Staging &&
    marker.environment === DeploymentEnvironment.Production
  )
    return DatabaseMismatch.StagingOnLive;
  if (
    environment === DeploymentEnvironment.Production &&
    marker.environment === DeploymentEnvironment.Staging
  )
    return DatabaseMismatch.LiveOnStaging;
  return null;
}
