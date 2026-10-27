'use client';

import { useHydrated } from '@/admin/hooks/use-hydrated';
import { formatDate, formatDateTime, SERVER_TIME_ZONE } from '@/admin/lib/format';

/**
 * A moment in the viewer's timezone. Server render and hydration use UTC (marked
 * "UTC"), so both sides produce the same text; right after hydration it switches
 * to the browser's timezone. Client-side navigations render local time directly.
 */
export function LocalTime({
  value,
  dateOnly = false,
}: {
  value: string | Date;
  dateOnly?: boolean;
}) {
  const hydrated = useHydrated();
  const timeZone = hydrated ? undefined : SERVER_TIME_ZONE;
  const text = dateOnly ? formatDate(value, timeZone) : formatDateTime(value, timeZone);
  return (
    <time dateTime={new Date(value).toISOString()}>
      {hydrated || dateOnly ? text : `${text} UTC`}
    </time>
  );
}
