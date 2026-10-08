import { formatNumber } from '@/admin/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/ui/card';
import type { Breakdown } from '@/core/analytics/queries';

/** Ranked list with proportional bars (top pages, referrers, devices…). */
export function BreakdownCard({
  title,
  description,
  rows,
  emptyText = 'No data yet.',
}: {
  title: string;
  description?: string;
  rows: readonly Breakdown[];
  emptyText?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.views));
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label={title}>
            {rows.map((row) => (
              <li
                key={row.value}
                className="text-sm relative flex items-center justify-between gap-3 overflow-hidden rounded-md px-2 py-1.5"
              >
                <span
                  aria-hidden
                  className="bg-muted absolute inset-y-0 start-0 rounded-md"
                  style={{ width: `${(row.views / max) * 100}%` }}
                />
                <span className="relative truncate">{row.value}</span>
                <span className="relative text-muted-foreground tabular-nums">
                  {formatNumber(row.views)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
