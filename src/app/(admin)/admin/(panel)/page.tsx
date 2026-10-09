import { desc } from 'drizzle-orm';
import type { Metadata } from 'next';

import { PageHeader } from '@/admin/components/layout/page-header';
import { BreakdownCard } from '@/admin/components/overview/breakdown-card';
import { KpiCard } from '@/admin/components/overview/kpi-card';
import { RangeSelect } from '@/admin/components/overview/range-select';
import { RecentActivity } from '@/admin/components/overview/recent-activity';
import { SiteStatusCard } from '@/admin/components/overview/site-status-card';
import { VisitorsChart } from '@/admin/components/overview/visitors-chart';
import { runAnalyticsMaintenance } from '@/core/analytics/maintenance';
import { getOverview, parseRange, RANGE_LABELS } from '@/core/analytics/queries';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import { getDb, getDbInfo } from '@/core/db/client';
import { auditLog } from '@/core/db/schema';
import { describeAuditTargets } from '@/core/security/audit-targets';
import { readSiteSettings } from '@/core/settings/repository';

export const metadata: Metadata = { title: 'Overview' };
export const instant = false;

const RECENT_ACTIVITY = 10;

export default async function OverviewPage({ searchParams }: PageProps<'/admin'>) {
  await requirePermission(Permission.OverviewView);
  const range = parseRange((await searchParams).range);
  const db = await getDb();
  await runAnalyticsMaintenance(db); // throttled: at most hourly
  const [overview, settings, activity] = await Promise.all([
    getOverview(db, range),
    readSiteSettings(db),
    db.select().from(auditLog).orderBy(desc(auditLog.ts)).limit(RECENT_ACTIVITY),
  ]);
  const { current, previous, breakdowns } = overview;
  const targetLabels = await describeAuditTargets(db, activity);

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${RANGE_LABELS[range]} · cookieless analytics`}
        actions={<RangeSelect value={range} />}
      />
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Unique visitors" value={current.visitors} previous={previous.visitors} />
        <KpiCard label="Page views" value={current.views} previous={previous.views} />
        <KpiCard
          label="Pages per visit"
          value={current.pagesPerVisit}
          previous={previous.pagesPerVisit}
          decimals={2}
        />
      </section>
      <VisitorsChart series={overview.series} />
      <section aria-label="Breakdowns" className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="Top pages" rows={breakdowns.path} />
        <BreakdownCard title="Top referrers" rows={breakdowns.referrer} />
        <BreakdownCard title="Devices" rows={breakdowns.device} />
        <BreakdownCard title="Browsers" rows={breakdowns.browser} />
        {breakdowns.country.length > 0 ? (
          <BreakdownCard title="Countries" rows={breakdowns.country} />
        ) : null}
      </section>
      <section aria-label="Status and activity" className="grid gap-4 lg:grid-cols-2">
        <SiteStatusCard settings={settings} db={getDbInfo()} />
        <RecentActivity
          rows={activity.map((row) => ({
            id: row.id,
            ts: row.ts.toISOString(),
            action: row.action,
            actorEmail: row.actorEmail,
            target: row.target ? (targetLabels.get(row.target) ?? row.target) : null,
          }))}
        />
      </section>
    </>
  );
}
