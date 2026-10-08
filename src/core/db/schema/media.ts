import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { mediaKindEnum } from './enums';

export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: mediaKindEnum('kind').notNull().default('image'),
    storageKey: text('storage_key').notNull().unique(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    width: integer('width'),
    height: integer('height'),
    /** Tiny base64 data URL used as `next/image` blur placeholder. */
    placeholder: text('placeholder'),
    originalName: text('original_name'),
    uploadedBy: text('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('media_created_at_idx').on(table.createdAt.desc())],
);
