import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from 'lucide-react';

import { formatNumber } from '@/admin/lib/format';
import { cn } from '@/admin/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/ui/card';
import { percentChange } from '@/core/analytics/range';

/** Primary KPI with change vs the previous period of the same length. */
export function KpiCard({
  label,
  value,
  previous,
  decimals = 0,
}: {
  label: string;
  value: number;
  previous: number;
  decimals?: number;
}) {
  const change = percentChange(value, previous);
  const Icon =
    change === null || change === 0
      ? MinusIcon
      : change > 0
        ? ArrowUpRightIcon
        : ArrowDownRightIcon;
  return (
    <Card>
      <CardHeader>
        <CardDescription>
          <h2>{label}</h2>
        </CardDescription>
        <CardTitle
          className="text-3xl font-semibold tabular-nums"
          data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {decimals > 0 ? value.toFixed(decimals) : formatNumber(value)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            'text-sm flex items-center gap-1 text-muted-foreground',
            change !== null && change > 0 && 'text-emerald-600 dark:text-emerald-400',
            change !== null && change < 0 && 'dark:text-red-400 text-red-600',
          )}
        >
          <Icon aria-hidden className="size-4" />
          {change === null
            ? 'No data for the previous period'
            : `${change > 0 ? '+' : ''}${change}% vs previous period`}
        </p>
      </CardContent>
    </Card>
  );
}
