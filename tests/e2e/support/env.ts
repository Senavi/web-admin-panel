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
