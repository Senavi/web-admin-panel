import { sql } from 'drizzle-orm';
import { check, integer, jsonb, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core';

import { users } from './auth';
import type { JsonObject } from './content';

/** Global site settings: a single row (id = 1), validated by `@/core/settings/schema`. */
export const settings = pgTable(
  'settings',
  {
    id: smallint('id').primaryKey().default(1),
    data: jsonb('data')
      .$type<JsonObject>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [check('settings_singleton', sql`${table.id} = 1`)],
);

/** Per-locale settings (title template, default description, OG defaults). */
export const settingsLocalized = pgTable('settings_localized', {
  locale: text('locale').primaryKey(),
  data: jsonb('data')
    .$type<JsonObject>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
});
