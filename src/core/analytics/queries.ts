import 'server-only';

import { and, gte, inArray, lte } from 'drizzle-orm';

import { analyticsDaily, type AnalyticsDimension } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

import { aggregateDay, ROLLUP_DIMENSIONS, type RollupDimension } from './maintenance';
import { type AnalyticsRange, RANGE_DAYS } from './range';
import { addDays, daysBetween, utcDay } from './time';

export { AnalyticsRange, parseRange, percentChange, RANGE_DAYS, RANGE_LABELS } from './range';

export interface Totals {
  readonly visitors: number;
  readonly views: number;
  /** Page views per (daily unique) visitor. */
  readonly pagesPerVisit: number;
}

export interface Breakdown {
  readonly value: string;
  readonly views: number;
  readonly visitors: number;
}

export interface Overview {
  readonly range: AnalyticsRange;
  readonly current: Totals;
  readonly previous: Totals;
  readonly series: ReadonlyArray<{ day: string; visitors: number; views: number }>;
  readonly breakdowns: Readonly<Record<RollupDimension, Breakdown[]>>;
}

type DayData = {
  total: { views: number; visitors: number };
  dims: Map<RollupDimension, Breakdown[]>;
};

/** Rollups for past days + live aggregation for today, in two queries plus today's aggregate. */
async function loadDays(
  db: Database,
  days: readonly string[],
  today: string,
): Promise<Map<string, DayData>> {
  const result = new Map<string, DayData>();
  const past = days.filter((day) => day < today);
  if (past.length > 0) {
    const rows = await db
      .select()
      .from(analyticsDaily)
      .where(
        and(
          gte(analyticsDaily.day, past[0] ?? today),
          lte(analyticsDaily.day, past.at(-1) ?? today),
          inArray(analyticsDaily.dimension, [
            'total',
            ...ROLLUP_DIMENSIONS,
          ] as AnalyticsDimension[]),
        ),
      );
    for (const row of rows) {
      const entry = result.get(row.day) ?? { total: { views: 0, visitors: 0 }, dims: new Map() };
      if (row.dimension === 'total') entry.total = { views: row.views, visitors: row.visitors };
      else {
        const list = entry.dims.get(row.dimension as RollupDimension) ?? [];
        list.push({ value: row.value, views: row.views, visitors: row.visitors });
        entry.dims.set(row.dimension as RollupDimension, list);
      }
      result.set(row.day, entry);
    }
  }
  if (days.includes(today)) {
    const live = await aggregateDay(db, today);
    result.set(today, {
      total: { ...live.total },
      dims: new Map(ROLLUP_DIMENSIONS.map((d) => [d, [...live.dimensions[d]]])),
    });
  }
  return result;
}

function totals(days: readonly string[], data: Map<string, DayData>): Totals {
  let views = 0;
  let visitors = 0;
  for (const day of days) {
    views += data.get(day)?.total.views ?? 0;
    visitors += data.get(day)?.total.visitors ?? 0;
  }
  return {
    views,
    visitors,
    pagesPerVisit: visitors > 0 ? Math.round((views / visitors) * 100) / 100 : 0,
  };
}

const TOP_LIMIT = 8;

export async function getOverview(
  db: Database,
  range: AnalyticsRange,
  now: Date = new Date(),
): Promise<Overview> {
  const today = utcDay(now);
  const length = RANGE_DAYS[range];
  const currentDays = daysBetween(addDays(today, -(length - 1)), today);
  const previousDays = daysBetween(addDays(today, -(2 * length - 1)), addDays(today, -length));
  const data = await loadDays(db, [...previousDays, ...currentDays], today);

  const breakdowns = {} as Record<RollupDimension, Breakdown[]>;
  for (const dimension of ROLLUP_DIMENSIONS) {
    const merged = new Map<string, Breakdown>();
    for (const day of currentDays) {
      for (const row of data.get(day)?.dims.get(dimension) ?? []) {
        const current = merged.get(row.value) ?? { value: row.value, views: 0, visitors: 0 };
        merged.set(row.value, {
          value: row.value,
          views: current.views + row.views,
          visitors: current.visitors + row.visitors,
        });
      }
    }
    breakdowns[dimension] = [...merged.values()]
      .sort((a, b) => b.views - a.views)
      .slice(0, TOP_LIMIT);
  }

  return {
    range,
    current: totals(currentDays, data),
    previous: totals(previousDays, data),
    series: currentDays.map((day) => ({
      day,
      visitors: data.get(day)?.total.visitors ?? 0,
      views: data.get(day)?.total.views ?? 0,
    })),
    breakdowns,
  };
}
