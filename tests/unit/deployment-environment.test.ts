import { describe, expect, it } from 'vitest';

import { migrationDecision } from '@/core/db/deploy-context';
import { acquireLock } from '@/core/db/deploy-lock';
import {
  deploymentEnvironment,
  DeploymentEnvironment,
  detectDeploymentEnvironment,
} from '@/core/deployment/environment';
import { STAGING_BRANCH } from '@/core/project/define';

const { Production, Staging, Preview, Development } = DeploymentEnvironment;
const detect = (env: Record<string, string>, branch = STAGING_BRANCH) =>
  detectDeploymentEnvironment(env, branch);

describe('deploymentEnvironment', () => {
  it('maps every Vercel environment', () => {
    expect(detect({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' })).toBe(Production);
    expect(detect({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'staging' })).toBe(Staging);
    expect(detect({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/x' })).toBe(Preview);
    expect(detect({ VERCEL_ENV: 'preview' })).toBe(Preview);
    expect(detect({ VERCEL_ENV: 'development' })).toBe(Development);
  });

  it('maps every Netlify context', () => {
    const netlify = (context: string, branch?: string) =>
      detect({ NETLIFY: 'true', CONTEXT: context, ...(branch ? { BRANCH: branch } : {}) });
    expect(netlify('production', 'main')).toBe(Production);
    expect(netlify('branch-deploy', 'staging')).toBe(Staging);
    expect(netlify('branch-deploy', 'feature/x')).toBe(Preview);
    expect(netlify('deploy-preview', 'staging')).toBe(Preview);
    expect(netlify('dev')).toBe(Development);
    // CONTEXT alone (without NETLIFY=true) is not a Netlify build.
    expect(detect({ CONTEXT: 'production', NODE_ENV: 'development' })).toBe(Development);
  });

  it('uses the project staging branch name', () => {
    expect(detect({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'dev' }, 'dev')).toBe(Staging);
    expect(detect({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'staging' }, 'dev')).toBe(
      Preview,
    );
  });

  it('falls back to NODE_ENV elsewhere and honours overrides', () => {
    expect(detect({ NODE_ENV: 'production' })).toBe(Production);
    expect(detect({})).toBe(Development);
    expect(
      deploymentEnvironment(
        { NODE_ENV: 'production', DEPLOYMENT_ENVIRONMENT: 'staging' },
        'staging',
      ),
    ).toBe(Staging);
    expect(deploymentEnvironment({ SITE_BUILD_ENVIRONMENT: 'preview' }, 'staging')).toBe(Preview);
    // An invalid override is ignored.
    expect(
      deploymentEnvironment({ DEPLOYMENT_ENVIRONMENT: 'qa', NODE_ENV: 'production' }, 'staging'),
    ).toBe(Production);
  });
});

describe('deploy migrations per environment', () => {
  const db = { DATABASE_URL: 'postgres://u:p@db.example.com:5432/app' };
  it('production migrates; staging only with its own database; previews never by default', () => {
    expect(migrationDecision({ ...db, VERCEL_ENV: 'production' }).migrate).toBe(true);
    const staging = { ...db, NETLIFY: 'true', CONTEXT: 'branch-deploy', BRANCH: 'staging' };
    expect(migrationDecision(staging).migrate).toBe(false);
    expect(migrationDecision(staging).reason).toMatch(/staging.*PREVIEW_DATABASE_ISOLATED=true/);
    expect(migrationDecision({ ...staging, PREVIEW_DATABASE_ISOLATED: 'true' }).migrate).toBe(true);
    const pr = { ...db, NETLIFY: 'true', CONTEXT: 'deploy-preview', BRANCH: 'feature/x' };
    expect(migrationDecision(pr).migrate).toBe(false);
    expect(migrationDecision(pr).reason).toMatch(/Previews never migrate/);
  });
});

describe('deploy lock', () => {
  const fakeClock = () => {
    let time = 0;
    return { now: () => time, sleep: async (ms: number) => void (time += ms) };
  };

  it('takes a free lock at once', async () => {
    let waits = 0;
    const got = await acquireLock(async () => true, {
      onWait: () => (waits += 1),
      clock: fakeClock(),
    });
    expect(got).toBe(true);
    expect(waits).toBe(0);
  });

  it('waits for the other deploy, logging once', async () => {
    let attempts = 0;
    let waits = 0;
    const got = await acquireLock(async () => (attempts += 1) > 3, {
      pollMs: 1000,
      timeoutMs: 60_000,
      onWait: () => (waits += 1),
      clock: fakeClock(),
    });
    expect(got).toBe(true);
    expect(attempts).toBe(4);
    expect(waits).toBe(1);
  });

  it('gives up after the timeout', async () => {
    const clock = fakeClock();
    const got = await acquireLock(async () => false, { pollMs: 1000, timeoutMs: 5000, clock });
    expect(got).toBe(false);
    expect(clock.now()).toBeLessThanOrEqual(5000);
  });
});
