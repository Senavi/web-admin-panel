/**
 * Test-only accounts created by `scripts/e2e-prepare.ts` in an isolated e2e
 * database. These are not real credentials and never exist outside e2e runs.
 */
export const E2E_ADMIN = {
  email: 'e2e-admin@example.test',
  password: 'Orbit-Lantern-Quartz-41',
  name: 'E2E Admin',
} as const;

export const E2E_MANAGER = {
  email: 'e2e-manager@example.test',
  password: 'Maple-Signal-Harbor-73',
  name: 'E2E Manager',
} as const;
