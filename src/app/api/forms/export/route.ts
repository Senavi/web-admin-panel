import { z } from 'zod';

import { can, Permission } from '@/core/auth/permissions';
import { getCurrentUser } from '@/core/auth/server/session';
import { contentRegistry } from '@/core/content/project-registry';
import { getDb } from '@/core/db/client';
import { exportCsv, InboxFilter } from '@/core/forms/inbox';
import { NO_STORE } from '@/core/http/headers';
import { AuditAction, writeAudit } from '@/core/security/audit';

const querySchema = z.object({
  form: z.string().min(1).max(64),
  status: z
    .enum(Object.values(InboxFilter) as [InboxFilter, ...InboxFilter[]])
    .default(InboxFilter.Open),
  q: z.string().max(100).default(''),
});

/** CSV export of a form's filtered submissions (staff with `forms.view`); audited. */
export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, Permission.FormsView)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': NO_STORE } });
  }
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  const form = parsed.success ? contentRegistry.formById(parsed.data.form) : undefined;
  if (!parsed.success || !form) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': NO_STORE } });
  }
  const db = await getDb();
  const { csv, count } = await exportCsv(db, form, parsed.data.status, parsed.data.q);
  await writeAudit(db, {
    action: AuditAction.SubmissionExport,
    actor: { id: user.id, email: user.email },
    target: `form:${form.id}`,
    summary: { count, status: parsed.data.status },
  });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${form.id}-submissions-${day}.csv"`,
      'Cache-Control': NO_STORE,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
