import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';
import type { JsonObject } from './content';

/** Append-only log of admin actions and login attempts. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    /** Snapshot of the actor's email (kept when the user is deleted). */
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    target: text('target'),
    /** Short diff summary, never secrets. */
    summary: jsonb('summary').$type<JsonObject>(),
    ipHash: text('ip_hash'),
  },
  (table) => [
    index('audit_log_ts_idx').on(table.ts.desc()),
    index('audit_log_action_ts_idx').on(table.action, table.ts.desc()),
    index('audit_log_actor_ts_idx').on(table.actorId, table.ts.desc()),
  ],
);

/** Login lockout state per key (`email:<address>` or `ip:<hash>`), with exponential backoff. */
export const loginThrottle = pgTable('login_throttle', {
  key: text('key').primaryKey(),
  failures: integer('failures').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Bookkeeping for lazily-run maintenance jobs (rollups, retention cleanup). */
export const systemJobs = pgTable('system_jobs', {
  name: text('name').primaryKey(),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }).notNull(),
  lastResult: jsonb('last_result').$type<JsonObject>(),
  runs: integer('runs').notNull().default(0),
});

/**
 * Which environment this database belongs to (single row, id = 1), written by
 * `db:prepare` on production and staging deploys (D-098). `db:clone` never copies
 * it and never overwrites a database marked `production`.
 */
export const databaseEnvironment = pgTable(
  'database_environment',
  {
    id: smallint('id').primaryKey().default(1),
    environment: text('environment').notNull(),
    /** `databaseIdentity()` of the database it was written for: a copy (Neon reset, backup) differs. */
    databaseIdentity: text('database_identity'),
    markedAt: timestamp('marked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('database_environment_singleton', sql`${table.id} = 1`)],
);
