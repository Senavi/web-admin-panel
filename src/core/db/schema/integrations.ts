import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { users } from './auth';

/**
 * Credentials of integrations (email API keys, SMTP password) entered in
 * Settings → Integrations. Only AES-256-GCM ciphertext is stored, never the
 * value (`@/core/integrations/crypto`); database and auth secrets stay in env.
 */
export const integrationSecrets = pgTable('integration_secrets', {
  /** `resend.apiKey`, `smtp.password`. */
  name: text('name').primaryKey(),
  /** `v1.<iv>.<tag>.<ciphertext>`. */
  value: text('value').notNull(),
  /** Masked tail shown in the admin (`••••1234`); empty for short values. */
  hint: text('hint').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
});
