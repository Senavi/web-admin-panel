import {
  deploymentEnvironment,
  DeploymentEnvironment,
  platformLabel,
} from '@/core/deployment/environment';
import { STAGING_BRANCH } from '@/core/project/define';

/**
 * Decides whether a deploy build may migrate and prepare its database (D-097):
 * production always; staging and previews only when `PREVIEW_DATABASE_ISOLATED=true`
 * says their database is their own (set it only where a staging database is
 * configured). Pull-request previews normally have no database (preview mode).
 * A branch must never change the production schema before it is merged.
 */
export type MigrationDecision =
  | { readonly migrate: true; readonly reason: string }
  | { readonly migrate: false; readonly reason: string };

export function migrationDecision(
  env: Record<string, string | undefined>,
  stagingBranch: string = STAGING_BRANCH,
): MigrationDecision {
  if (!env.DATABASE_URL?.trim()) {
    return {
      migrate: false,
      reason:
        'no DATABASE_URL: the site deploys in preview mode (seed content, no admin). Add the database variables (docs/DEPLOYMENT.md) and redeploy to connect a database.',
    };
  }
  const environment = deploymentEnvironment(env, stagingBranch);
  const platform = platformLabel(env);
  if (!platform) return { migrate: true, reason: `not a platform build (${environment})` };
  const where = `${platform} → ${environment}`;
  if (environment === DeploymentEnvironment.Production)
    return { migrate: true, reason: `${where} deploy` };
  if (env.PREVIEW_DATABASE_ISOLATED === 'true') {
    return {
      migrate: true,
      reason: `${where}: PREVIEW_DATABASE_ISOLATED=true (this deploy has its own database)`,
    };
  }
  return {
    migrate: false,
    reason:
      environment === DeploymentEnvironment.Staging
        ? `${where}: skipped. Give the staging branch its own database and set PREVIEW_DATABASE_ISOLATED=true for that branch only (docs/DEPLOYMENT.md § Environments).`
        : `${where}: skipped. Previews never migrate a database; they normally run in preview mode (no DATABASE_URL in the Deploy Previews context).`,
  };
}
