import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { formatNumber } from '@/admin/lib/format';
import { cn } from '@/admin/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/ui/card';
import { percentChange } from '@/core/analytics/range';

function Change({ value, previous }: { value: number; previous: number }) {
  const change = percentChange(value, previous);
  const Icon =
    change === null || change === 0
      ? MinusIcon
      : change > 0
        ? ArrowUpRightIcon
        : ArrowDownRightIcon;
  return (
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
  );
}

/**
 * Primary KPI: the value plus either the change vs the previous period of the
 * same length or a custom footer (e.g. a link to the inbox).
 */
export function KpiCard({
  label,
  value,
  previous,
  decimals = 0,
  footer,
}: {
  label: string;
  value: number;
  previous?: number;
  decimals?: number;
  footer?: ReactNode;
}) {
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
        {footer ?? (previous !== undefined ? <Change value={value} previous={previous} /> : null)}
      </CardContent>
    </Card>
  );
}
