'use server';

import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { z } from 'zod';

import { ok, type ActionResult } from '@/core/actions/result';
import { GuardError, runAction } from '@/core/actions/run';
import { Permission } from '@/core/auth/permissions';
import { assertPermission } from '@/core/auth/server/session';
import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';
import { sessions, users } from '@/core/db/schema';

import { AuditAction, writeAudit } from './audit';

/** Revokes one session of any user (Security → Sessions). */
export async function revokeSessionAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await assertPermission(Permission.SecurityManage);
    const { sessionId } = z.object({ sessionId: z.string().min(1).max(64) }).parse(input);
    if (sessionId === actor.sessionId)
      throw new GuardError('Use “Sign out” to end your current session.');
    const db = await getDb();
    const [session] = await db
      .delete(sessions)
      .where(eq(sessions.id, sessionId))
      .returning({ userId: sessions.userId });
    if (session) {
      // Also invalidate that user's signed site-gate cookies.
      await db
        .update(users)
        .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
        .where(eq(users.id, session.userId));
      updateTag(CacheTag.Staff);
    }
    await writeAudit(db, {
      action: AuditAction.SessionRevoke,
      actor: { id: actor.id, email: actor.email },
      target: `session:${sessionId}`,
    });
    return ok(undefined, 'Session revoked.');
  });
}

/** Signs out everyone except the current session. */
export async function revokeAllSessionsAction(): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await assertPermission(Permission.SecurityManage);
    const db = await getDb();
    const revoked = await db
      .delete(sessions)
      .where(ne(sessions.id, actor.sessionId))
      .returning({ userId: sessions.userId });
    const userIds = [...new Set(revoked.map((row) => row.userId).filter((id) => id !== actor.id))];
    if (userIds.length > 0) {
      await db
        .update(users)
        .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
        .where(and(inArray(users.id, userIds)));
    }
    updateTag(CacheTag.Staff);
    await writeAudit(db, {
      action: AuditAction.SessionRevoke,
      actor: { id: actor.id, email: actor.email },
      target: 'sessions:all',
      summary: { revoked: revoked.length },
    });
    return ok(undefined, `${revoked.length} session(s) revoked.`);
  });
}
