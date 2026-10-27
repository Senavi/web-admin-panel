import { projectConfig } from '@project/config';

import { deploymentEnvironment, DeploymentEnvironment } from './environment';

/**
 * The environment of this server or script (no `server-only`: the request proxy
 * and scripts use it too). See `environment.ts`.
 */
export function currentEnvironment(): DeploymentEnvironment {
  return deploymentEnvironment(
    {
      DEPLOYMENT_ENVIRONMENT: process.env.DEPLOYMENT_ENVIRONMENT,
      // Inlined by next.config at build time (platform variables may be missing at runtime).
      SITE_BUILD_ENVIRONMENT: process.env.SITE_BUILD_ENVIRONMENT,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
      NETLIFY: process.env.NETLIFY,
      CONTEXT: process.env.CONTEXT,
      BRANCH: process.env.BRANCH,
      NODE_ENV: process.env.NODE_ENV,
    },
    projectConfig.stagingBranch,
  );
}

/** Staging: a test database (often a copy of production) that must never act like the live site. */
export function isStaging(): boolean {
  return currentEnvironment() === DeploymentEnvironment.Staging;
}
