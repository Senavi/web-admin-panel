'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { ActionErrorCode, ok, type ActionResult } from '@/core/actions/result';
import { GuardError, runAction } from '@/core/actions/run';
import { Permission } from '@/core/auth/permissions';
import { assertPermission } from '@/core/auth/server/session';
import { contentRegistry } from '@/core/content/project-registry';
import { getDb } from '@/core/db/client';
import { formSubmissions } from '@/core/db/schema';
import { AuditAction, writeAudit } from '@/core/security/audit';

import { SubmissionStatus } from './inbox-status';

const FORM_ID = z.string().min(1).max(64);
const MAX_BATCH = 100;

function formOrThrow(formId: string) {
  const form = contentRegistry.formById(formId);
  if (!form) throw new GuardError('Unknown form.', ActionErrorCode.NotFound);
  return form;
}

/** Mark read / unread (new) / archived. Managers and admins. */
export async function setSubmissionStatusAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertPermission(Permission.FormsView);
    const { formId, ids, status } = z
      .object({
        formId: FORM_ID,
        ids: z.array(z.uuid()).min(1).max(MAX_BATCH),
        status: z.enum([SubmissionStatus.New, SubmissionStatus.Read, SubmissionStatus.Archived]),
      })
      .parse(input);
    const form = formOrThrow(formId);
    const db = await getDb();
    const updated = await db
      .update(formSubmissions)
      .set({ status })
      .where(and(eq(formSubmissions.formId, form.id), inArray(formSubmissions.id, ids)))
      .returning({ id: formSubmissions.id });
    await writeAudit(db, {
      action: AuditAction.SubmissionStatus,
      actor: { id: user.id, email: user.email },
      target: `form:${form.id}`,
      summary: { status, count: updated.length },
    });
    return ok(null, status === SubmissionStatus.Archived ? 'Archived.' : 'Updated.');
  });
}

/** Permanently deletes a submission (e.g. a GDPR request). Admins only. */
export async function deleteSubmissionAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertPermission(Permission.FormsDelete);
    const { formId, id } = z.object({ formId: FORM_ID, id: z.uuid() }).parse(input);
    const form = formOrThrow(formId);
    const db = await getDb();
    const deleted = await db
      .delete(formSubmissions)
      .where(and(eq(formSubmissions.formId, form.id), eq(formSubmissions.id, id)))
      .returning({ id: formSubmissions.id });
    if (deleted.length === 0)
      throw new GuardError('This submission no longer exists.', ActionErrorCode.NotFound);
    await writeAudit(db, {
      action: AuditAction.SubmissionDelete,
      actor: { id: user.id, email: user.email },
      target: `form:${form.id}`,
      summary: { submissionId: id },
    });
    return ok(null, 'Submission deleted.');
  });
}
