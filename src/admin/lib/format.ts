/** Admin UI is English-only; format dates and numbers consistently regardless of browser locale. */
export const ADMIN_LOCALE = 'en-GB';

/**
 * The server renders times in UTC (it can't know the browser's timezone); the
 * browser then shows them in its own. Render instants with `<LocalTime>`, which
 * does exactly that without a hydration mismatch.
 */
export const SERVER_TIME_ZONE = 'UTC';

/** `timeZone` undefined: the runtime's own (the browser's in `<LocalTime>` after hydration). */
export function formatDateTime(value: string | Date, timeZone?: string): string {
  return new Date(value).toLocaleString(ADMIN_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  });
}

export function formatDate(value: string | Date, timeZone?: string): string {
  return new Date(value).toLocaleDateString(ADMIN_LOCALE, { dateStyle: 'medium', timeZone });
}

/** A calendar day key (`2026-10-27`, analytics) as a date: the same day in every timezone. */
export function formatDay(day: string): string {
  return formatDate(day, SERVER_TIME_ZONE);
}

export function formatNumber(value: number): string {
  return value.toLocaleString(ADMIN_LOCALE);
}
