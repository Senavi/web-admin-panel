import 'server-only';

import { and, eq, gte, lt, sql } from 'drizzle-orm';

import { analyticsDaily, analyticsEvents, analyticsSalts, systemJobs } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { readSiteSettings } from '@/core/settings/repository';

import { addDays, utcDay } from './time';

export const ANALYTICS_JOB = 'analytics-maintenance';
/** Lazy runs (page views, Overview) happen at most this often. */
const LAZY_INTERVAL_MS = 60 * 60 * 1000;

const DIMENSION_COLUMNS = {
  path: sql`${analyticsEvents.path}`,
  referrer: sql`coalesce(${analyticsEvents.referrerHost}, '(direct)')`,
  device: sql`${analyticsEvents.deviceType}::text`,
  browser: sql`coalesce(${analyticsEvents.browser}, 'Other')`,
  country: sql`${analyticsEvents.country}`,
} as const;

function dayRange(day: string) {
  return { from: new Date(`${day}T00:00:00Z`), to: new Date(`${addDays(day, 1)}T00:00:00Z`) };
}

export interface DayAggregate {
  readonly total: { readonly views: number; readonly visitors: number };
  readonly dimensions: Readonly<
    Record<RollupDimension, ReadonlyArray<{ value: string; views: number; visitors: number }>>
  >;
}
export type RollupDimension = keyof typeof DIMENSION_COLUMNS;
export const ROLLUP_DIMENSIONS = Object.keys(DIMENSION_COLUMNS) as RollupDimension[];

/** Aggregates one day's raw events (used for rollups and for "today", which is never rolled up). */
export async function aggregateDay(db: Database, day: string): Promise<DayAggregate> {
  const { from, to } = dayRange(day);
  const inDay = and(gte(analyticsEvents.ts, from), lt(analyticsEvents.ts, to));
  const [total] = await db
    .select({
      views: sql<number>`count(*)::int`,
      visitors: sql<number>`count(distinct ${analyticsEvents.visitorHash})::int`,
    })
    .from(analyticsEvents)
    .where(inDay);
  const dimensions = {} as Record<
    RollupDimension,
    Array<{ value: string; views: number; visitors: number }>
  >;
  for (const dimension of ROLLUP_DIMENSIONS) {
    const column = DIMENSION_COLUMNS[dimension];
    dimensions[dimension] = await db
      .select({
        value: sql<string>`${column}`,
        views: sql<number>`count(*)::int`,
        visitors: sql<number>`count(distinct ${analyticsEvents.visitorHash})::int`,
      })
      .from(analyticsEvents)
      .where(and(inDay, sql`${column} is not null`))
      .groupBy(column);
  }
  return { total: { views: total?.views ?? 0, visitors: total?.visitors ?? 0 }, dimensions };
}

/** Recomputes the daily rollups of one (complete) day. Idempotent. */
export async function rollupDay(db: Database, day: string): Promise<void> {
  const aggregate = await aggregateDay(db, day);
  await db.transaction(async (tx) => {
    await tx.delete(analyticsDaily).where(eq(analyticsDaily.day, day));
    if (aggregate.total.views === 0) return;
    await tx
      .insert(analyticsDaily)
      .values({ day, dimension: 'total', value: '', ...aggregate.total });
    for (const dimension of ROLLUP_DIMENSIONS) {
      const rows = aggregate.dimensions[dimension];
      if (rows.length > 0) {
        await tx.insert(analyticsDaily).values(
          rows.map((row) => ({
            day,
            dimension,
            value: row.value.slice(0, 512),
            views: row.views,
            visitors: row.visitors,
          })),
        );
      }
    }
  });
}

/** Complete days that have events but no rollup yet, plus yesterday (late events). */
async function daysNeedingRollup(db: Database, today: string): Promise<string[]> {
  const rows = await db
    .select({ day: sql<string>`to_char(${analyticsEvents.ts} at time zone 'UTC', 'YYYY-MM-DD')` })
    .from(analyticsEvents)
    .where(lt(analyticsEvents.ts, new Date(`${today}T00:00:00Z`)))
    .groupBy(sql`1`);
  const rolled = new Set(
    (
      await db
        .select({ day: analyticsDaily.day })
        .from(analyticsDaily)
        .where(eq(analyticsDaily.dimension, 'total'))
    ).map((row) => row.day),
  );
  const days = new Set(rows.map((row) => row.day).filter((day) => !rolled.has(day)));
  days.add(addDays(today, -1));
  return [...days].sort();
}

export interface MaintenanceSummary {
  readonly skipped: boolean;
  readonly rolledUp: string[];
  readonly deletedEvents: number;
}

/**
 * Rollups, retention cleanup and salt deletion. Runs lazily (throttled) and
 * from the protected cron endpoint (`force`).
 */
export async function runAnalyticsMaintenance(
  db: Database,
  options: { force?: boolean; now?: Date } = {},
): Promise<MaintenanceSummary> {
  const now = options.now ?? new Date();
  const [job] = await db.select().from(systemJobs).where(eq(systemJobs.name, ANALYTICS_JOB));
  if (!options.force && job && now.getTime() - job.lastRunAt.getTime() < LAZY_INTERVAL_MS) {
    return { skipped: true, rolledUp: [], deletedEvents: 0 };
  }
  // Claim the run first so concurrent lazy triggers don't all do the work.
  await db
    .insert(systemJobs)
    .values({ name: ANALYTICS_JOB, lastRunAt: now, runs: 1 })
    .onConflictDoUpdate({
      target: systemJobs.name,
      set: { lastRunAt: now, runs: sql`${systemJobs.runs} + 1` },
    });

  const today = utcDay(now);
  const days = await daysNeedingRollup(db, today);
  for (const day of days) await rollupDay(db, day);

  const { analytics } = await readSiteSettings(db);
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - analytics.retentionMonths);
  const deleted = await db
    .delete(analyticsEvents)
    .where(lt(analyticsEvents.ts, cutoff))
    .returning({ id: analyticsEvents.id });
  await db.delete(analyticsSalts).where(lt(analyticsSalts.day, today));

  const summary = { skipped: false, rolledUp: days, deletedEvents: deleted.length };
  await db
    .update(systemJobs)
    .set({ lastResult: { ...summary } })
    .where(eq(systemJobs.name, ANALYTICS_JOB));
  return summary;
}
