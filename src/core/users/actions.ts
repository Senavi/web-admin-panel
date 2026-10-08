'use server';

import { and, count, eq, sql } from 'drizzle-orm';
import { updateTag } from 'next/cache';

import { projectConfig } from '@project/config';

import { ActionErrorCode, fail, ok, type ActionResult } from '@/core/actions/result';
import { GuardError, runAction } from '@/core/actions/run';
import { generateTemporaryPassword } from '@/core/auth/password-policy';
import { Permission } from '@/core/auth/permissions';
import { isRole, Role, UserStatus } from '@/core/auth/roles';
import { assertPermission, type CurrentUser } from '@/core/auth/server/session';
import {
  createUserWithPassword,
  findUserByEmail,
  findUserById,
  revokeAllSessions,
  setPassword,
  setUserStatus,
} from '@/core/auth/server/users';
import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';
import { users } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { adminHref, AdminRoute } from '@/core/project/paths';
import { AuditAction, writeAudit } from '@/core/security/audit';
import { absoluteUrl } from '@/core/seo/site-url';

import { type UserChange, userChangeViolation } from './guards';
import { createUserSchema, setStatusSchema, updateUserSchema, userIdSchema } from './validation';

async function activeAdmins(db: Database): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.role, Role.Admin), eq(users.status, UserStatus.Active)));
  return row?.value ?? 0;
}

async function loadTarget(db: Database, id: string) {
  const target = await findUserById(db, id);
  if (!target || !isRole(target.role))
    throw new GuardError('User not found.', ActionErrorCode.NotFound);
  return target;
}

async function enforce(
  db: Database,
  actor: CurrentUser,
  target: { id: string; role: Role; status: UserStatus },
  change: UserChange,
) {
  const violation = userChangeViolation(change, {
    actorId: actor.id,
    target,
    activeAdmins: await activeAdmins(db),
  });
  if (violation) throw new GuardError(violation);
}

async function notifyInvite(input: {
  email: string;
  name: string;
  temporaryPassword: string;
  reason: 'created' | 'password-reset';
}) {
  if (!projectConfig.onUserInvited) return;
  try {
    await projectConfig.onUserInvited({
      ...input,
      loginUrl: absoluteUrl(adminHref(AdminRoute.Login)),
    });
  } catch (error) {
    console.error('[users] onUserInvited hook failed', error);
  }
}

const actorRef = (user: CurrentUser) => ({ id: user.id, email: user.email });

/** Creates a user with a temporary password (shown once) that must be changed on first login. */
export async function createUserAction(
  input: unknown,
): Promise<ActionResult<{ temporaryPassword: string }>> {
  return runAction(async () => {
    const actor = await assertPermission(Permission.ManagersManage);
    const data = createUserSchema.parse(input);
    const db = await getDb();
    if (await findUserByEmail(db, data.email)) {
      return fail('A user with this email already exists.', ActionErrorCode.Validation, {
        email: ['Already in use.'],
      });
    }
    const temporaryPassword = generateTemporaryPassword();
    const user = await createUserWithPassword(db, {
      ...data,
      password: temporaryPassword,
      mustChangePassword: true,
    });
    await writeAudit(db, {
      action: AuditAction.UserCreate,
      actor: actorRef(actor),
      target: `user:${user.id}`,
      summary: { role: data.role },
    });
    updateTag(CacheTag.Staff);
    await notifyInvite({
      email: user.email,
      name: user.name,
      temporaryPassword,
      reason: 'created',
    });
    return ok({ temporaryPassword }, 'User created.');
  });
}

export async function updateUserAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await assertPermission(Permission.ManagersManage);
    const data = updateUserSchema.parse(input);
    const db = await getDb();
    const target = await loadTarget(db, data.id);
    await enforce(db, actor, target, { type: 'role', role: data.role });
    const roleChanged = target.role !== data.role;
    await db
      .update(users)
      .set({
        name: data.name,
        role: data.role,
        // A role change invalidates signed gate cookies (they carry the role).
        ...(roleChanged ? { sessionVersion: sql`${users.sessionVersion} + 1` } : {}),
      })
      .where(eq(users.id, data.id));
    await writeAudit(db, {
      action: AuditAction.UserUpdate,
      actor: actorRef(actor),
      target: `user:${data.id}`,
      summary: {
        name: target.name !== data.name,
        role: roleChanged ? `${target.role}→${data.role}` : undefined,
      },
    });
    if (roleChanged) updateTag(CacheTag.Staff);
    return ok(undefined, 'User updated.');
  });
}

export async function setUserStatusAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await assertPermission(Permission.ManagersManage);
    const data = setStatusSchema.parse(input);
    const db = await getDb();
    const target = await loadTarget(db, data.id);
    await enforce(db, actor, target, { type: 'status', status: data.status });
    await setUserStatus(db, data.id, data.status);
    await writeAudit(db, {
      action:
        data.status === UserStatus.Disabled ? AuditAction.UserDisable : AuditAction.UserEnable,
      actor: actorRef(actor),
      target: `user:${data.id}`,
    });
    updateTag(CacheTag.Staff);
    return ok(
      undefined,
      data.status === UserStatus.Disabled ? 'User disabled and signed out.' : 'User enabled.',
    );
  });
}

/** New temporary password (shown once); all the user's sessions are revoked. */
export async function resetUserPasswordAction(
  input: unknown,
): Promise<ActionResult<{ temporaryPassword: string }>> {
  return runAction(async () => {
    const actor = await assertPermission(Permission.ManagersManage);
    const { id } = userIdSchema.parse(input);
    const db = await getDb();
    const target = await loadTarget(db, id);
    if (target.id === actor.id)
      throw new GuardError('Change your own password on the Account page.');
    const temporaryPassword = generateTemporaryPassword();
    await setPassword(db, id, temporaryPassword, { email: target.email, mustChangePassword: true });
    await writeAudit(db, {
      action: AuditAction.UserPasswordReset,
      actor: actorRef(actor),
      target: `user:${id}`,
    });
    updateTag(CacheTag.Staff);
    await notifyInvite({
      email: target.email,
      name: target.name,
      temporaryPassword,
      reason: 'password-reset',
    });
    return ok({ temporaryPassword }, 'Password reset. The user is signed out everywhere.');
  });
}

export async function revokeUserSessionsAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await assertPermission(Permission.ManagersManage);
    const { id } = userIdSchema.parse(input);
    const db = await getDb();
    await loadTarget(db, id);
    if (id === actor.id) throw new GuardError('Use your Account page to sign out other sessions.');
    await revokeAllSessions(db, id);
    await writeAudit(db, {
      action: AuditAction.UserSessionsRevoke,
      actor: actorRef(actor),
      target: `user:${id}`,
    });
    updateTag(CacheTag.Staff);
    return ok(undefined, 'All sessions of this user were revoked.');
  });
}

export async function deleteUserAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await assertPermission(Permission.ManagersManage);
    const { id } = userIdSchema.parse(input);
    const db = await getDb();
    const target = await loadTarget(db, id);
    await enforce(db, actor, target, { type: 'delete' });
    await db.delete(users).where(eq(users.id, id));
    await writeAudit(db, {
      action: AuditAction.UserDelete,
      actor: actorRef(actor),
      target: `user:${id}`,
      summary: { email: target.email },
    });
    updateTag(CacheTag.Staff);
    return ok(undefined, 'User deleted.');
  });
}
