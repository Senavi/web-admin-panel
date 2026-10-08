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

/** Locale key used for non-localized ("shared across languages") field values. */
export const SHARED_LOCALE = '_shared';

export type JsonObject = Record<string, unknown>;

/** Content values per (page, locale). `version` drives optimistic concurrency. */
export const pageContent = pgTable(
  'page_content',
  {
    pageId: text('page_id').notNull(),
    locale: text('locale').notNull(),
    data: jsonb('data')
      .$type<JsonObject>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [primaryKey({ columns: [table.pageId, table.locale] })],
);

/** SEO overrides per (page, locale). */
export const pageSeo = pgTable(
  'page_seo',
  {
    pageId: text('page_id').notNull(),
    locale: text('locale').notNull(),
    data: jsonb('data')
      .$type<JsonObject>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [primaryKey({ columns: [table.pageId, table.locale] })],
);

export interface RevisionSnapshot {
  /** Localized content for the revision's locale. */
  readonly content: JsonObject;
  /** Shared (non-localized) content at the time of the revision. */
  readonly shared: JsonObject;
  readonly seo: JsonObject;
}

/** Last N revisions per (page, locale); pruned on save. */
export const pageRevisions = pgTable(
  'page_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pageId: text('page_id').notNull(),
    locale: text('locale').notNull(),
    snapshot: jsonb('snapshot').$type<RevisionSnapshot>().notNull(),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: text('author_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('page_revisions_page_locale_created_idx').on(
      table.pageId,
      table.locale,
      table.createdAt.desc(),
    ),
  ],
);
