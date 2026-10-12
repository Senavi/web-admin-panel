import { and, desc, ilike, or, type SQL } from 'drizzle-orm';
import type { Metadata } from 'next';

import { PageHeader } from '@/admin/components/layout/page-header';
import {
  AUDIT_GROUPS,
  type AuditGroup,
  AuditLogTable,
} from '@/admin/components/security/audit-log-table';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import { auditLog } from '@/core/db/schema';
import { adminHref, AdminRoute } from '@/core/project/paths';
import { describeAuditTargets } from '@/core/security/audit-targets';

export const metadata: Metadata = { title: 'Activity' };
export const instant = false;

const PAGE_SIZE = 25;

/** The full activity log: every admin change and sign-in attempt, filterable. */
export default async function ActivityPage({
  searchParams,
}: PageProps<'/admin/security/activity'>) {
  await requirePermission(Permission.SecurityManage);
  const params = await searchParams;
  const group: AuditGroup =
    typeof params.group === 'string' && params.group in AUDIT_GROUPS
      ? (params.group as AuditGroup)
      : 'all';
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const page = Math.max(1, Number(params.page) || 1);

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

  const db = await getDb();
  const rows = await db
    .select()
    .from(auditLog)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(auditLog.ts))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  const targetLabels = await describeAuditTargets(db, rows);

  return (
    <>
      <PageHeader title="Activity" description="Every change in the admin and every sign-in." />
      <section id="activity" aria-label="Activity log">
        <AuditLogTable
          rows={rows.slice(0, PAGE_SIZE).map((row) => ({
            id: row.id,
            ts: row.ts.toISOString(),
            action: row.action,
            actorEmail: row.actorEmail,
            target: row.target ? (targetLabels.get(row.target) ?? row.target) : null,
            summary: row.summary ? JSON.stringify(row.summary) : null,
          }))}
          group={group}
          query={query}
          page={page}
          hasNext={rows.length > PAGE_SIZE}
          basePath={adminHref(AdminRoute.Activity)}
        />
      </section>
    </>
  );
}
