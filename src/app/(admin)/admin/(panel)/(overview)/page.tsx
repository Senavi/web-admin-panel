import type { Metadata } from 'next';
import Link from 'next/link';

import { Alert, AlertDescription } from '@/admin/ui/alert';
import { mailStatus } from '@/core/forms/mail-status';
import { hasRecipients } from '@/core/integrations/health';
import { MailSource } from '@/core/mail/config';
import { CollapsibleSection } from '@/admin/components/layout/accordion';
import { PageHeader } from '@/admin/components/layout/page-header';
import { BreakdownCard } from '@/admin/components/overview/breakdown-card';
import { KpiCard } from '@/admin/components/overview/kpi-card';
import { RangeSelect } from '@/admin/components/overview/range-select';
import { VisitorsChart } from '@/admin/components/overview/visitors-chart';
import { getOverview, parseRange, RANGE_LABELS } from '@/core/analytics/queries';
import { can, Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import { localeInfo } from '@/core/i18n/locales';
import { selectedLocales } from '@/core/i18n/language-state';
import { contentRegistry } from '@/core/content/project-registry';
import { currentEnvironment } from '@/core/deployment/current';
import { indexingLabel } from '@/core/deployment/rules';
import { getDb } from '@/core/db/client';
import { countNew } from '@/core/forms/inbox';
import { runMaintenance } from '@/core/maintenance';
import { adminHref, AdminRoute, PagesArea, pagesAreaHref } from '@/core/project/paths';
import type { SiteSettings } from '@/core/settings/schema';
import { getRequestSettings } from '@/core/settings/request';
import { timed } from '@/core/perf/timing';

export const metadata: Metadata = { title: 'Overview' };
export const instant = false;

function siteStateText(status: SiteSettings['status']): string {
  if (status.maintenance.enabled) return 'The site is paused';
  if (status.privateMode) return 'The site is private';
  return 'The site is live';
}

function localeNames(general: SiteSettings['general']): string {
  return selectedLocales(general)
    .map((code) =>
      general.draftLocales.includes(code)
        ? `${localeInfo(code).label} (draft)`
        : localeInfo(code).label,
    )
    .join(', ');
}

export default async function OverviewPage({ searchParams }: PageProps<'/admin'>) {
  const user = await requirePermission(Permission.OverviewView);
  const range = parseRange((await searchParams).range);
  const db = await getDb();
  await runMaintenance(db); // throttled: at most hourly
  const forms = contentRegistry.forms;
  const showRequests = forms.length > 0 && can(user.role, Permission.FormsView);
  const [overview, settings, unread] = await Promise.all([
    timed('db:overview', () => getOverview(db, range)),
    getRequestSettings(),
    showRequests
      ? countNew(
          db,
          forms.map((form) => form.id),
        )
      : Promise.resolve({} as Record<string, number>),
  ]);
  const { current, previous, breakdowns } = overview;
  const newRequests = Object.values(unread).reduce((sum, value) => sum + value, 0);
  // The inbox with the most new requests (or the first form).
  const inboxForm =
    [...forms].sort((a, b) => (unread[b.id] ?? 0) - (unread[a.id] ?? 0))[0] ?? forms[0];

  // Email is connected but nobody receives requests.
  const mail = showRequests ? await mailStatus(db) : null;
  const unemailed =
    mail !== null &&
    mail.configured &&
    mail.source !== MailSource.Dev &&
    !hasRecipients(settings.forms);

  const statusParts = [
    siteStateText(settings.status),
    indexingLabel(settings.status.indexing, currentEnvironment()),
    localeNames(settings.general),
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        description={`How the site is doing · ${RANGE_LABELS[range].toLowerCase()}`}
        actions={<RangeSelect value={range} />}
      />
      {unemailed ? (
        <Alert role="alert" data-testid="no-recipients-warning">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            Requests are saved but not emailed: add recipients.
            {can(user.role, Permission.SettingsManage) ? (
              <Link
                href={`${adminHref(AdminRoute.Settings)}?tab=requests`}
                className="font-medium underline underline-offset-4"
              >
                Open Settings → Requests
              </Link>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Visitors" value={current.visitors} previous={previous.visitors} />
        <KpiCard label="Page views" value={current.views} previous={previous.views} />
        {showRequests && inboxForm ? (
          <KpiCard
            label="New requests"
            value={newRequests}
            footer={
              <Link
                href={pagesAreaHref(PagesArea.Forms, inboxForm.id)}
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                Open the inbox
              </Link>
            }
          />
        ) : (
          <KpiCard
            label="Pages per visit"
            value={current.pagesPerVisit}
            previous={previous.pagesPerVisit}
            decimals={2}
          />
        )}
      </section>
      <VisitorsChart series={overview.series} />
      <section aria-label="Pages and sources" className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="Most visited pages" rows={breakdowns.path} />
        <BreakdownCard title="Where visitors come from" rows={breakdowns.referrer} />
      </section>
      <CollapsibleSection
        id="more-statistics"
        title="More statistics"
        summary="Devices, browsers, countries"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownCard title="Devices" rows={breakdowns.device} />
          <BreakdownCard title="Browsers" rows={breakdowns.browser} />
          {breakdowns.country.length > 0 ? (
            <BreakdownCard title="Countries" rows={breakdowns.country} />
          ) : null}
        </div>
      </CollapsibleSection>
      <p
        aria-label="Site status"
        className="text-sm flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground"
      >
        {statusParts.map((part, index) => (
          <span key={part} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden>·</span> : null}
            {part}
          </span>
        ))}
        {can(user.role, Permission.SecurityManage) ? (
          <span className="flex items-center gap-2">
            <span aria-hidden>·</span>
            <Link
              href={adminHref(AdminRoute.Activity)}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Recent activity
            </Link>
          </span>
        ) : null}
      </p>
    </>
  );
}
