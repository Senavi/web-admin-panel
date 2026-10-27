import { defineConfig, devices } from '@playwright/test';

/**
 * Staging-mode E2E: the production build started with DEPLOYMENT_ENVIRONMENT=staging
 * on the e2e database, run by `pnpm e2e:staging` (scripts/e2e-prod.ts --staging).
 */
export default defineConfig({
  testDir: './tests/e2e-staging',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3400',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
