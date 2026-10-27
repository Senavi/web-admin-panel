import { desc, eq, gt } from 'drizzle-orm';
import { DatabaseIcon } from 'lucide-react';
import type { Metadata } from 'next';

import { DeveloperSection } from '@/admin/components/layout/developer-mode';
import { PageHeader } from '@/admin/components/layout/page-header';
import { SectionCard } from '@/admin/components/layout/section-card';
import { ActivityList } from '@/admin/components/security/activity-list';
import { ConnectNeonWizard } from '@/admin/components/security/connect-neon-wizard';
import { ConnectSupabaseWizard } from '@/admin/components/security/connect-supabase-wizard';
import { SessionsTable } from '@/admin/components/security/sessions-table';
import { StatusCard } from '@/admin/components/security/status-card';
import { Button } from '@/admin/ui/button';
import { Permission } from '@/core/auth/permissions';
import { authSecretSource } from '@/core/auth/secret';
import { requirePermission } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import { sessions, users } from '@/core/db/schema';
import { DbMode } from '@/core/db/types';
import { describeUsage } from '@/core/database/usage';
import { DATABASE_PROVIDER_LABELS, databaseProvider } from '@/core/db/connection-info';
import { currentEnvironment } from '@/core/deployment/current';
import { ENVIRONMENT_LABELS } from '@/core/deployment/environment';
import { env, isProduction } from '@/core/env';
import { projectConfig } from '@project/config';
import { resolveSiteUrl } from '@/core/site-url';
import { adminHref, AdminRoute } from '@/core/project/paths';
import { recentActivity } from '@/core/security/activity';
import { checkSiteHealth } from '@/core/security/status';
import { timed } from '@/core/perf/timing';
import { STORAGE_DRIVER_LABELS } from '@/core/storage/types';

export const metadata: Metadata = { title: 'Security' };
export const instant = false;

const RECENT_ACTIVITY = 8;

/** Where the signing secret comes from; a derived secret is fine, not a problem. */
const AUTH_SECRET_SOURCE_LABELS: Record<ReturnType<typeof authSecretSource>, string> = {
  env: 'AUTH_SECRET',
  derived: 'Derived from SUPABASE_SERVICE_ROLE_KEY (rotating that key signs everyone out)',
  development: 'Development secret (.data/dev-auth-secret)',
  preview: 'Preview mode',
};

function Line({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
      {sub ? <span className="text-xs break-all text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

/** Address prefilled in the Connect Supabase hosting step (a localhost URL is not useful there). */
function productionSiteUrl(): string {
  const url = resolveSiteUrl();
  return url && !/localhost|127\.0\.0\.1/.test(url) ? url : 'https://example.com';
}

export default async function SecurityPage() {
  const me = await requirePermission(Permission.SecurityManage);
  const production = isProduction();
  const db = await getDb();
  const [health, sessionRows, activity] = await Promise.all([
    timed('health', () => checkSiteHealth()),
    db
      .select({
        id: sessions.id,
        email: users.email,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(gt(sessions.expiresAt, new Date()))
      .orderBy(desc(sessions.createdAt)),
    timed('db:activity', () => recentActivity(db, RECENT_ACTIVITY)),
  ]);
  const { database, storage } = health;
  const local = database.mode === DbMode.Local;
  const provider = databaseProvider(env().DATABASE_URL);
  const providerLabel = provider ? DATABASE_PROVIDER_LABELS[provider] : 'Postgres';
  const environment = currentEnvironment();

  return (
    <>
      <PageHeader title="Security" description="Who is signed in and what changed." />
      <StatusCard problems={health.problems} okText={health.okText} />
      <SectionCard
        id="devices"
        title="Signed-in devices"
        description="Every device where someone is signed in to the admin."
      >
        <SessionsTable
          rows={sessionRows.map((row) => ({
            id: row.id,
            email: row.email,
            userAgent: row.userAgent,
            createdAt: row.createdAt.toISOString(),
            current: row.id === me.sessionId,
          }))}
        />
      </SectionCard>
      <ActivityList items={activity} fullLogHref={adminHref(AdminRoute.Activity)} />
      <DeveloperSection id="developer-settings">
        <div className="grid gap-3 sm:grid-cols-2">
          <Line
            label="Database"
            value={
              database.ok
                ? `${local ? 'Local database (this computer)' : providerLabel} · OK · ${database.latencyMs} ms`
                : `${local ? 'Local database' : providerLabel} · ${database.error ?? 'Failed'}`
            }
            sub={local ? 'Not used on the live site' : database.host}
          />
          <Line
            label="Environment"
            value={ENVIRONMENT_LABELS[environment]}
            sub={`Staging branch: ${projectConfig.stagingBranch}`}
          />
          {health.usage ? (
            <>
              <Line
                label="Database size"
                value={describeUsage(health.usage.database)}
                sub={health.usage.plan}
              />
              <Line
                label="Images"
                value={describeUsage(health.usage.storage)}
                sub={health.usage.plan}
              />
            </>
          ) : null}
          <Line
            label="File storage"
            value={`${STORAGE_DRIVER_LABELS[storage.driver]} · ${
              storage.ok ? 'OK' : (storage.error ?? 'Failed')
            }`}
            sub={storage.location}
          />
          <Line label="Email" value={health.mail.line} />
          <Line label="Sign-in secret" value={AUTH_SECRET_SOURCE_LABELS[authSecretSource()]} />
        </div>
        {!production && local ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Connect an online database</span>
            <div className="flex flex-wrap items-center gap-3">
              <ConnectNeonWizard
                staffEmail={me.email}
                trigger={
                  <Button>
                    <DatabaseIcon />
                    Neon (recommended)
                  </Button>
                }
              />
              <ConnectSupabaseWizard
                siteUrl={productionSiteUrl()}
                trigger={
                  <Button variant="outline">
                    <DatabaseIcon />
                    Supabase
                  </Button>
                }
              />
            </div>
            <span className="text-sm text-muted-foreground">
              Neon: database and file storage with production and staging branches. Step-by-step
              guides for Netlify and Vercel.
            </span>
          </div>
        ) : null}
      </DeveloperSection>
    </>
  );
}
