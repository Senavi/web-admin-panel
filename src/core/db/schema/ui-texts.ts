import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';

/**
 * Interface texts edited in the admin: one row per (namespace, language) holding
 * only the texts that differ from the project's message files
 * (`{ "readMore": "Learn more" }`, nested keys joined with dots).
 */
export const uiTexts = pgTable(
  'ui_texts',
  {
    namespace: text('namespace').notNull(),
    locale: text('locale').notNull(),
    data: jsonb('data')
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** Optimistic concurrency, as for page content. */
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [primaryKey({ columns: [table.namespace, table.locale] })],
);

/** Earlier states of an interface text row (what it was before a save). */
export const uiTextRevisions = pgTable(
  'ui_text_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    namespace: text('namespace').notNull(),
    locale: text('locale').notNull(),
    snapshot: jsonb('snapshot').$type<Record<string, string>>().notNull(),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: text('author_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ui_text_revisions_ns_locale_created_idx').on(
      table.namespace,
      table.locale,
      table.createdAt.desc(),
    ),
  ],
);
