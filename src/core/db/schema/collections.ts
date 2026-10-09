import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';
import type { JsonObject, RevisionSnapshot } from './content';
import { collectionItemStatusEnum } from './enums';

/**
 * Collection items (docs/CONTENT_SCHEMA.md § Collections). Content, SEO and
 * revisions mirror the page tables, keyed by item instead of page id.
 */
export const collectionItems = pgTable(
  'collection_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collectionId: text('collection_id').notNull(),
    /** Shared across locales: `[a-z0-9-]`, unique per collection. */
    slug: text('slug').notNull(),
    status: collectionItemStatusEnum('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /** Optimistic concurrency for slug/status/date changes. */
    version: integer('version').notNull().default(1),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('collection_items_collection_slug_uq').on(table.collectionId, table.slug),
    index('collection_items_list_idx').on(
      table.collectionId,
      table.status,
      table.publishedAt.desc(),
    ),
  ],
);

export const collectionItemContent = pgTable(
  'collection_item_content',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => collectionItems.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    data: jsonb('data')
      .$type<JsonObject>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [primaryKey({ columns: [table.itemId, table.locale] })],
);

export const collectionItemSeo = pgTable(
  'collection_item_seo',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => collectionItems.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    data: jsonb('data')
      .$type<JsonObject>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [primaryKey({ columns: [table.itemId, table.locale] })],
);

export const collectionItemRevisions = pgTable(
  'collection_item_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => collectionItems.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    snapshot: jsonb('snapshot').$type<RevisionSnapshot>().notNull(),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: text('author_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('collection_item_revisions_item_locale_created_idx').on(
      table.itemId,
      table.locale,
      table.createdAt.desc(),
    ),
  ],
);

/** Old slugs keep working: requests for them are redirected (308) to the item's current URL. */
export const collectionSlugRedirects = pgTable(
  'collection_slug_redirects',
  {
    collectionId: text('collection_id').notNull(),
    oldSlug: text('old_slug').notNull(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => collectionItems.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.collectionId, table.oldSlug] })],
);

/**
 * Seed items `content:sync` has created once. Deleting or renaming a seeded item
 * in the admin must not bring it back on the next sync.
 */
export const collectionSeedLog = pgTable(
  'collection_seed_log',
  {
    collectionId: text('collection_id').notNull(),
    slug: text('slug').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.collectionId, table.slug] })],
);
