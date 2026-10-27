/**
 * Test-only environment shared by `scripts/e2e-prod.ts`, `playwright.config.ts`
 * and the specs (CI repeats them in .github/workflows/ci.yml). Never real secrets.
 */
export const E2E_ENV = {
  /** Form emails are written to `<SITE_DATA_DIR>/mail/`. */
  MAIL_PROVIDER: 'dev',
  MAIL_FROM: 'Site Starter <forms@example.test>',
  FORMS_WEBHOOK_SECRET: 'e2e-webhook-secret-0123456789',
  CRON_SECRET: 'e2e-cron-secret-0123456789',
} as const;

/** `pnpm e2e:staging`: the team address staging form emails go to (STAGING_MAIL_TO). */
export const E2E_STAGING_MAIL_TO = 'staging-team@example.test';

/** Data dir of the server under test (dev e2e: .data/e2e; prod e2e: SITE_DATA_DIR; CI: .data). */
export const E2E_DATA_DIR =
  process.env.SITE_DATA_DIR ?? (process.env.E2E_BASE_URL ? '.data' : '.data/e2e');
