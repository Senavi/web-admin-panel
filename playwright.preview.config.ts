import { defineConfig, devices } from '@playwright/test';

/**
 * Preview-mode E2E (production build without any database variables), run by
 * `pnpm e2e:preview`, which builds, starts the app and sets E2E_BASE_URL.
 */
export default defineConfig({
  testDir: './tests/e2e-preview',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3500',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
