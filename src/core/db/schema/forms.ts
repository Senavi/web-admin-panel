import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { formSubmissionStatusEnum } from './enums';

/** Per destination (`email`, `webhook`, `telegram`): result of the last delivery attempt. */
export interface DeliveryRecord {
  readonly status: 'pending' | 'sent' | 'failed';
  readonly attempts: number;
  readonly at: string;
  /** Short, non-sensitive reason (never submission data). */
  readonly error?: string;
}
export type DeliveryState = Readonly<Record<string, DeliveryRecord>>;

/** Form submissions (PII): kept for the retention period from Settings → Forms. */
export const formSubmissions = pgTable(
  'form_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: text('form_id').notNull(),
    locale: text('locale').notNull(),
    data: jsonb('data').$type<Record<string, string | boolean>>().notNull(),
    pagePath: text('page_path'),
    status: formSubmissionStatusEnum('status').notNull().default('new'),
    delivery: jsonb('delivery').$type<DeliveryState>().notNull().default({}),
    /** Keyed hash of the client IP (rate limiting); raw IPs are never stored. */
    ipHash: text('ip_hash'),
    /** Browser family only (e.g. "Chrome"), never the full user agent. */
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('form_submissions_inbox_idx').on(table.formId, table.status, table.createdAt.desc()),
  ],
);
