import { desc, eq, gt } from 'drizzle-orm';
import { DatabaseIcon } from 'lucide-react';
import type { Metadata } from 'next';

import { DeveloperSection } from '@/admin/components/layout/developer-mode';
import { PageHeader } from '@/admin/components/layout/page-header';
import { SectionCard } from '@/admin/components/layout/section-card';
import { ActivityList } from '@/admin/components/security/activity-list';
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
import { isProduction } from '@/core/env';
import { resolveSiteUrl } from '@/core/site-url';
import { adminHref, AdminRoute } from '@/core/project/paths';
import { recentActivity } from '@/core/security/activity';
import { checkSiteHealth } from '@/core/security/status';
import { timed } from '@/core/perf/timing';

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
                ? `${local ? 'Local database (this computer)' : 'Postgres'} · OK · ${database.latencyMs} ms`
                : `${local ? 'Local database' : 'Postgres'} · ${database.error ?? 'Failed'}`
            }
            sub={local ? 'Not used on the live site' : database.host}
          />
          <Line
            label="File storage"
            value={`${storage.driver === 'local' ? 'Local folder' : 'Supabase Storage'} · ${
              storage.ok ? 'OK' : (storage.error ?? 'Failed')
            }`}
            sub={storage.location}
          />
          <Line label="Email" value={health.mail.line} />
          <Line label="Sign-in secret" value={AUTH_SECRET_SOURCE_LABELS[authSecretSource()]} />
        </div>
        {!production && local ? (
          <div className="flex flex-wrap items-center gap-3">
            <ConnectSupabaseWizard
              siteUrl={productionSiteUrl()}
              trigger={
                <Button>
                  <DatabaseIcon />
                  Connect Supabase
                </Button>
              }
            />
            <span className="text-sm text-muted-foreground">
              Step-by-step guide for Vercel or Netlify
            </span>
          </div>
        ) : null}
      </DeveloperSection>
    </>
  );
}
