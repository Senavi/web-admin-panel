import {
  bigserial,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { deviceTypeEnum } from './enums';

/** Raw page views. No cookies, no IPs: `visitorHash` rotates daily (see docs/SECURITY.md). */
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    path: text('path').notNull(),
    pageId: text('page_id'),
    /** Set for collection item URLs (path identifies the item). */
    collectionId: text('collection_id'),
    locale: text('locale'),
    visitorHash: text('visitor_hash').notNull(),
    referrerHost: text('referrer_host'),
    deviceType: deviceTypeEnum('device_type').notNull().default('other'),
    browser: text('browser'),
    country: text('country'),
  },
  (table) => [
    index('analytics_events_ts_idx').on(table.ts),
    index('analytics_events_page_ts_idx').on(table.pageId, table.ts),
  ],
);

/** Dimensions aggregated in `analytics_daily`. */
export const ANALYTICS_DIMENSIONS = [
  'total',
  'path',
  'referrer',
  'device',
  'browser',
  'country',
] as const;
export type AnalyticsDimension = (typeof ANALYTICS_DIMENSIONS)[number];

/**
 * Daily rollups. One row per (day, dimension, value). `visitors` counts distinct
 * daily visitor hashes, so summing across days is correct (hashes rotate daily).
 */
export const analyticsDaily = pgTable(
  'analytics_daily',
  {
    day: date('day', { mode: 'string' }).notNull(),
    dimension: text('dimension').$type<AnalyticsDimension>().notNull(),
    value: text('value').notNull(),
    views: integer('views').notNull().default(0),
    visitors: integer('visitors').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.day, table.dimension, table.value] }),
    index('analytics_daily_dimension_day_idx').on(table.dimension, table.day),
  ],
);

/** Daily salt for visitor hashing. Rows for past days are deleted by maintenance. */
export const analyticsSalts = pgTable('analytics_salts', {
  day: date('day', { mode: 'string' }).primaryKey(),
  salt: text('salt').notNull(),
});
