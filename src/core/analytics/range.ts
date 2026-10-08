/** Overview date ranges (shared by server queries and client controls). */
export const AnalyticsRange = { Today: 'today', Week: '7d', Month: '30d', Quarter: '90d' } as const;
export type AnalyticsRange = (typeof AnalyticsRange)[keyof typeof AnalyticsRange];
export const RANGE_DAYS: Record<AnalyticsRange, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
};
export const RANGE_LABELS: Record<AnalyticsRange, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

export function parseRange(value: unknown): AnalyticsRange {
  return typeof value === 'string' && value in RANGE_DAYS
    ? (value as AnalyticsRange)
    : AnalyticsRange.Week;
}

/** Relative change in percent (null when there is no previous data). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
