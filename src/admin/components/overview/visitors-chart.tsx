'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { formatDate } from '@/admin/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/admin/ui/chart';

const config = {
  views: { label: 'Page views', color: 'var(--chart-1)' },
  visitors: { label: 'Visitors', color: 'var(--chart-2)' },
} satisfies ChartConfig;

/** Visitors and page views over time (admin only; recharts never ships to the site). */
export function VisitorsChart({
  series,
}: {
  series: ReadonlyArray<{ day: string; visitors: number; views: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Traffic</h2>
        </CardTitle>
        <CardDescription>Unique visitors and page views per day (UTC).</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-72 w-full">
          <AreaChart data={[...series]} margin={{ left: 0, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={(day: string) => formatDate(day).replace(/ \d{4}$/, '')}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={(day) => formatDate(String(day))} />}
            />
            <Area
              dataKey="views"
              type="monotone"
              fill="var(--color-views)"
              fillOpacity={0.15}
              stroke="var(--color-views)"
            />
            <Area
              dataKey="visitors"
              type="monotone"
              fill="var(--color-visitors)"
              fillOpacity={0.25}
              stroke="var(--color-visitors)"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
