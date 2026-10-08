import { and, desc, eq, gt, ilike, or, type SQL } from 'drizzle-orm';
import { DatabaseIcon } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader } from '@/admin/components/layout/page-header';
import { SectionCard } from '@/admin/components/layout/section-card';
import {
  AUDIT_GROUPS,
  type AuditGroup,
  AuditLogTable,
} from '@/admin/components/security/audit-log-table';
import { ConnectSupabaseWizard } from '@/admin/components/security/connect-supabase-wizard';
import { EnvTable } from '@/admin/components/security/env-table';
import { SessionsTable } from '@/admin/components/security/sessions-table';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import { auditLog, sessions, users } from '@/core/db/schema';
import { DbMode } from '@/core/db/types';
import { isProduction } from '@/core/env';
import { adminHref, AdminRoute } from '@/core/project/paths';
import { envStatus } from '@/core/security/env-catalog';
import { checkDatabase, checkStorage } from '@/core/security/health';

export const metadata: Metadata = { title: 'Security' };
export const instant = false;

const PAGE_SIZE = 25;

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <Badge variant={ok ? 'secondary' : 'destructive'}>{children}</Badge>;
}

export default async function SecurityPage({ searchParams }: PageProps<'/admin/security'>) {
  const me = await requirePermission(Permission.SecurityManage);
  const params = await searchParams;
  const group: AuditGroup =
    typeof params.group === 'string' && params.group in AUDIT_GROUPS
      ? (params.group as AuditGroup)
      : 'all';
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const page = Math.max(1, Number(params.page) || 1);
  const production = isProduction();

  const db = await getDb();
  const filters: SQL[] = [];
  const prefixes: readonly string[] = AUDIT_GROUPS[group].prefixes;
  if (prefixes.length > 0) {
    const anyPrefix = or(...prefixes.map((prefix) => ilike(auditLog.action, `${prefix}%`)));
    if (anyPrefix) filters.push(anyPrefix);
  }
  if (query) {
    const text = or(ilike(auditLog.actorEmail, `%${query}%`), ilike(auditLog.target, `%${query}%`));
    if (text) filters.push(text);
  }

  const [database, storage, sessionRows, auditRows] = await Promise.all([
    checkDatabase(),
    checkStorage(),
    db
      .select({
        id: sessions.id,
        email: users.email,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(gt(sessions.expiresAt, new Date()))
      .orderBy(desc(sessions.createdAt)),
    db
      .select()
      .from(auditLog)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(auditLog.ts))
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  return (
    <>
      <PageHeader
        title="Security"
        description="Database, storage, environment, sessions and audit log."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard id="database" title="Database">
          <dl className="text-sm flex flex-col gap-2">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Mode</dt>
              <dd>
                {database.mode === DbMode.Local ? 'Local (PGlite, this machine only)' : 'Postgres'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Host</dt>
              <dd className="text-xs font-mono">{database.host ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Connection</dt>
              <dd>
                <Status ok={database.ok}>
                  {database.ok ? `OK · ${database.latencyMs} ms` : (database.error ?? 'Failed')}
                </Status>
              </dd>
            </div>
          </dl>
          {!production && database.mode === DbMode.Local ? (
            <div className="mt-4">
              <ConnectSupabaseWizard
                trigger={
                  <Button>
                    <DatabaseIcon />
                    Connect Supabase
                  </Button>
                }
              />
            </div>
          ) : null}
          {production ? (
            <p className="text-sm mt-4 text-muted-foreground">
              Database and storage are configured with environment variables on your hosting
              platform (Vercel: Project → Settings → Environment Variables; Netlify: Site
              configuration → Environment variables). Secrets are never stored in the database. See
              the checklist below and docs/DEPLOYMENT.md.
            </p>
          ) : null}
        </SectionCard>
        <SectionCard id="storage" title="Storage">
          <dl className="text-sm flex flex-col gap-2">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Adapter</dt>
              <dd>{storage.driver === 'local' ? 'Local filesystem' : 'Supabase Storage'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="text-xs font-mono">{storage.location}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Status ok={storage.ok}>{storage.ok ? 'OK' : (storage.error ?? 'Failed')}</Status>
              </dd>
            </div>
          </dl>
        </SectionCard>
      </div>
      <SectionCard
        id="environment"
        title="Environment"
        description={
          production
            ? 'Required variables must be set on the hosting platform.'
            : 'Values come from .env.local / the shell.'
        }
      >
        <EnvTable rows={envStatus(process.env)} production={production} />
      </SectionCard>
      <SectionCard
        id="sessions"
        title="Active sessions"
        description="Every signed-in device of every user."
      >
        <SessionsTable
          rows={sessionRows.map((row) => ({
            id: row.id,
            email: row.email,
            userAgent: row.userAgent,
            createdAt: row.createdAt.toISOString(),
            expiresAt: row.expiresAt.toISOString(),
            current: row.id === me.sessionId,
          }))}
        />
      </SectionCard>
      <SectionCard
        id="audit-log"
        title="Audit log"
        description="Admin actions and sign-in attempts."
      >
        <AuditLogTable
          rows={auditRows.slice(0, PAGE_SIZE).map((row) => ({
            id: row.id,
            ts: row.ts.toISOString(),
            action: row.action,
            actorEmail: row.actorEmail,
            target: row.target,
            summary: row.summary ? JSON.stringify(row.summary) : null,
          }))}
          group={group}
          query={query}
          page={page}
          hasNext={auditRows.length > PAGE_SIZE}
          basePath={adminHref(AdminRoute.Security)}
        />
      </SectionCard>
    </>
  );
}
