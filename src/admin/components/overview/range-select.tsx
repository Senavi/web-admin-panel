'use client';

import { usePathname, useRouter } from 'next/navigation';

import { ToggleGroup, ToggleGroupItem } from '@/admin/ui/toggle-group';
import { type AnalyticsRange, RANGE_LABELS } from '@/core/analytics/range';

const SHORT: Record<AnalyticsRange, string> = {
  today: 'Today',
  '7d': '7d',
  '30d': '30d',
  '90d': '90d',
};

/** Date range for the whole Overview page (kept in the URL). */
export function RangeSelect({ value }: { value: AnalyticsRange }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next) => {
        const range = next[0];
        if (range && range !== value) router.push(`${pathname}?range=${range}`);
      }}
      variant="outline"
      aria-label="Date range"
    >
      {(Object.keys(SHORT) as AnalyticsRange[]).map((range) => (
        <ToggleGroupItem key={range} value={range} aria-label={RANGE_LABELS[range]}>
          {SHORT[range]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
