/**
 * Which environment a build or server runs in (D-097). Pure (no `server-only`):
 * used by the deploy scripts, the env schema, the request proxy and the app.
 *
 * | environment | Vercel                                   | Netlify                           |
 * | production  | VERCEL_ENV=production                    | CONTEXT=production                |
 * | staging     | VERCEL_ENV=preview + staging branch      | CONTEXT=branch-deploy + staging   |
 * | preview     | any other preview (pull requests…)       | deploy-preview, other branches    |
 * | development | VERCEL_ENV=development, local `pnpm dev` | CONTEXT=dev, local `pnpm dev`     |
 *
 * Elsewhere (self-hosting, CI): production for production builds, else development.
 * `DEPLOYMENT_ENVIRONMENT` overrides the detection (self-hosted staging, tests). The
 * value detected at build time is also inlined as `SITE_BUILD_ENVIRONMENT`
 * (next.config), so the server knows it even where the platform doesn't pass its
 * build variables to functions.
 */
export const DeploymentEnvironment = {
  Production: 'production',
  Staging: 'staging',
  Preview: 'preview',
  Development: 'development',
} as const;
export type DeploymentEnvironment =
  (typeof DeploymentEnvironment)[keyof typeof DeploymentEnvironment];

const VALUES = new Set<string>(Object.values(DeploymentEnvironment));

export const ENVIRONMENT_LABELS: Record<DeploymentEnvironment, string> = {
  production: 'Production (the live site)',
  staging: 'Staging (test database)',
  preview: 'Preview',
  development: 'Development (this computer)',
};

const VercelEnv = { Production: 'production', Preview: 'preview', Development: 'development' };
const NetlifyContext = {
  Production: 'production',
  BranchDeploy: 'branch-deploy',
  DeployPreview: 'deploy-preview',
  Dev: 'dev',
};

function parseEnvironment(value: string | undefined): DeploymentEnvironment | null {
  const trimmed = value?.trim();
  return trimmed && VALUES.has(trimmed) ? (trimmed as DeploymentEnvironment) : null;
}

type Source = Readonly<Record<string, string | undefined>>;

/** Detection from the platform variables only (what the build sees). */
export function detectDeploymentEnvironment(
  env: Source,
  stagingBranch: string,
): DeploymentEnvironment {
  const vercel = env.VERCEL_ENV?.trim();
  if (vercel) {
    if (vercel === VercelEnv.Production) return DeploymentEnvironment.Production;
    if (vercel === VercelEnv.Development) return DeploymentEnvironment.Development;
    return env.VERCEL_GIT_COMMIT_REF?.trim() === stagingBranch
      ? DeploymentEnvironment.Staging
      : DeploymentEnvironment.Preview;
  }
  const netlify = env.NETLIFY === 'true' ? env.CONTEXT?.trim() : undefined;
  if (netlify) {
    if (netlify === NetlifyContext.Production) return DeploymentEnvironment.Production;
    if (netlify === NetlifyContext.Dev) return DeploymentEnvironment.Development;
    if (netlify === NetlifyContext.BranchDeploy && env.BRANCH?.trim() === stagingBranch)
      return DeploymentEnvironment.Staging;
    return DeploymentEnvironment.Preview;
  }
  return env.NODE_ENV === 'production'
    ? DeploymentEnvironment.Production
    : DeploymentEnvironment.Development;
}

/**
 * The environment: `DEPLOYMENT_ENVIRONMENT`, then the value inlined at build time,
 * then the platform variables. `stagingBranch` comes from `projectConfig`.
 */
export function deploymentEnvironment(env: Source, stagingBranch: string): DeploymentEnvironment {
  return (
    parseEnvironment(env.DEPLOYMENT_ENVIRONMENT) ??
    parseEnvironment(env.SITE_BUILD_ENVIRONMENT) ??
    detectDeploymentEnvironment(env, stagingBranch)
  );
}

/** Short platform description for the build log (`Netlify (branch-deploy, staging)`). */
export function platformLabel(env: Source): string | null {
  if (env.VERCEL_ENV)
    return `Vercel (${env.VERCEL_ENV}${env.VERCEL_GIT_COMMIT_REF ? `, ${env.VERCEL_GIT_COMMIT_REF}` : ''})`;
  if (env.NETLIFY === 'true')
    return `Netlify (${env.CONTEXT ?? 'unknown'}${env.BRANCH ? `, ${env.BRANCH}` : ''})`;
  return null;
}
