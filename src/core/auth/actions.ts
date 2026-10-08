'use server';

import { APIError } from 'better-auth/api';
import { and, eq, ne, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';

import { ActionErrorCode, fail, ok, type ActionResult } from '@/core/actions/result';
import { GuardError, runAction } from '@/core/actions/run';
import { getDb } from '@/core/db/client';
import { sessions, users } from '@/core/db/schema';
import { adminHref, AdminRoute, safeRedirectPath } from '@/core/project/paths';
import { AuditAction, writeAudit } from '@/core/security/audit';
import { readSiteSettings } from '@/core/settings/repository';
import { clearGateCookie, issueGateCookie } from '@/core/site-gate/cookie';

import { checkPassword } from './password-policy';
import { Role } from './roles';
import { getAuth } from './server/instance';
import { signInWithPassword, verifySecondFactor } from './server/login';
import { assertSignedIn } from './server/session';
import {
  changePasswordSchema,
  loginSchema,
  passwordConfirmSchema,
  profileSchema,
  sessionIdSchema,
  totpCodeSchema,
  twoFactorCodeSchema,
} from './validation';

export interface LoginState {
  readonly step: 'password' | 'two-factor';
  readonly error: string | null;
  /** Echoed back so the email field keeps its value after an error. */
  readonly email: string;
  /** Incremented on every response (resets the code input after a failed attempt). */
  readonly attempt: number;
}

const defaultAfterLogin = () => adminHref(AdminRoute.Overview);

/**
 * Login form action (works without JavaScript via `useActionState`):
 * `intent=password` checks email + password, `intent=two-factor` verifies a TOTP
 * or backup code. Redirects to `next` on success.
 */
export async function loginFormAction(
  previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const intent = formData.get('intent');
  const next = formData.get('next');
  const attempt = previous.attempt + 1;

  if (intent === 'two-factor') {
    const parsed = twoFactorCodeSchema.safeParse({
      code: formData.get('code'),
      method: formData.get('method'),
      next,
    });
    if (!parsed.success)
      return { ...previous, attempt, step: 'two-factor', error: 'Invalid verification code.' };
    const outcome = await verifySecondFactor(parsed.data.code, parsed.data.method);
    if (outcome.status !== 'success') {
      return {
        ...previous,
        attempt,
        step: 'two-factor',
        error: outcome.status === 'error' ? outcome.message : 'Invalid code.',
      };
    }
    redirect(safeRedirectPath(parsed.data.next, defaultAfterLogin()));
  }

  const email = typeof formData.get('email') === 'string' ? String(formData.get('email')) : '';
  const parsed = loginSchema.safeParse({ email, password: formData.get('password'), next });
  if (!parsed.success)
    return { step: 'password', error: 'Invalid email or password.', email, attempt };
  const outcome = await signInWithPassword(parsed.data.email, parsed.data.password);
  switch (outcome.status) {
    case 'error':
      return { step: 'password', error: outcome.message, email, attempt };
    case 'two-factor':
      return { step: 'two-factor', error: null, email, attempt };
    case 'success':
      redirect(safeRedirectPath(parsed.data.next, defaultAfterLogin()));
  }
}

export async function signOutAction(): Promise<void> {
  const auth = await getAuth();
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (session) {
    await auth.api.signOut({ headers: requestHeaders });
    await writeAudit(await getDb(), {
      action: AuditAction.Logout,
      actor: { id: session.user.id, email: session.user.email },
    });
  }
  await clearGateCookie();
  redirect(adminHref(AdminRoute.Login));
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertSignedIn();
    const data = changePasswordSchema.parse(input);
    const policy = checkPassword(data.newPassword, { email: user.email });
    if (!policy.ok) {
      return fail(policy.message, ActionErrorCode.Validation, { newPassword: [policy.message] });
    }
    const auth = await getAuth();
    try {
      await auth.api.changePassword({
        body: {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
          revokeOtherSessions: true,
        },
        headers: await headers(),
      });
    } catch (error) {
      if (error instanceof APIError) {
        return fail('The current password is incorrect.', ActionErrorCode.Validation, {
          currentPassword: ['The current password is incorrect.'],
        });
      }
      throw error;
    }
    const db = await getDb();
    const [updated] = await db
      .update(users)
      .set({ mustChangePassword: false, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, user.id))
      .returning({ sessionVersion: users.sessionVersion });
    await issueGateCookie({
      id: user.id,
      role: user.role,
      sessionVersion: updated?.sessionVersion ?? 0,
    });
    await writeAudit(db, {
      action: AuditAction.PasswordChange,
      actor: { id: user.id, email: user.email },
      target: `user:${user.id}`,
    });
    return ok(undefined, 'Password changed. Other sessions were signed out.');
  });
}

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertSignedIn();
    const data = profileSchema.parse(input);
    const db = await getDb();
    await db.update(users).set({ name: data.name }).where(eq(users.id, user.id));
    await writeAudit(db, {
      action: AuditAction.UserUpdate,
      actor: { id: user.id, email: user.email },
      target: `user:${user.id}`,
      summary: { fields: ['name'] },
    });
    return ok(undefined, 'Profile updated.');
  });
}

export interface TwoFactorSetup {
  readonly qrSvg: string;
  readonly secretUri: string;
  readonly backupCodes: string[];
}

export async function startTwoFactorSetupAction(
  input: unknown,
): Promise<ActionResult<TwoFactorSetup>> {
  return runAction(async () => {
    await assertSignedIn();
    const { password } = passwordConfirmSchema.parse(input);
    const auth = await getAuth();
    try {
      const result = await auth.api.enableTwoFactor({
        body: { password },
        headers: await headers(),
      });
      if (result.method !== 'totp') throw new Error('Expected a TOTP enrolment.');
      const qrSvg = await QRCode.toString(result.totpURI, { type: 'svg', margin: 1 });
      return ok({ qrSvg, secretUri: result.totpURI, backupCodes: result.backupCodes });
    } catch (error) {
      if (error instanceof APIError) {
        return fail('Incorrect password.', ActionErrorCode.Validation, {
          password: ['Incorrect password.'],
        });
      }
      throw error;
    }
  });
}

export async function confirmTwoFactorAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertSignedIn();
    const { code } = totpCodeSchema.parse(input);
    const auth = await getAuth();
    try {
      await auth.api.verifyTOTP({ body: { code }, headers: await headers() });
    } catch (error) {
      if (error instanceof APIError) {
        return fail('Invalid code. Check your authenticator app.', ActionErrorCode.Validation, {
          code: ['Invalid code.'],
        });
      }
      throw error;
    }
    await writeAudit(await getDb(), {
      action: AuditAction.TwoFactorEnable,
      actor: { id: user.id, email: user.email },
      target: `user:${user.id}`,
    });
    return ok(undefined, 'Two-factor authentication is on.');
  });
}

export async function disableTwoFactorAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertSignedIn();
    const { password } = passwordConfirmSchema.parse(input);
    const db = await getDb();
    const { security } = await readSiteSettings(db);
    if (security.requireTwoFactorForAdmins && user.role === Role.Admin) {
      throw new GuardError(
        'Two-factor authentication is required for admins by the security policy.',
      );
    }
    const auth = await getAuth();
    try {
      await auth.api.disableTwoFactor({ body: { password }, headers: await headers() });
    } catch (error) {
      if (error instanceof APIError) {
        return fail('Incorrect password.', ActionErrorCode.Validation, {
          password: ['Incorrect password.'],
        });
      }
      throw error;
    }
    await writeAudit(db, {
      action: AuditAction.TwoFactorDisable,
      actor: { id: user.id, email: user.email },
      target: `user:${user.id}`,
    });
    return ok(undefined, 'Two-factor authentication is off.');
  });
}

export async function revokeOwnSessionAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertSignedIn();
    const { sessionId } = sessionIdSchema.parse(input);
    if (sessionId === user.sessionId) {
      throw new GuardError('Use “Sign out” to end the current session.');
    }
    const db = await getDb();
    await db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));
    await writeAudit(db, {
      action: AuditAction.SessionRevoke,
      actor: { id: user.id, email: user.email },
      target: `session:${sessionId}`,
    });
    return ok(undefined, 'Session revoked.');
  });
}

export async function revokeOtherSessionsAction(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertSignedIn();
    const db = await getDb();
    await db
      .delete(sessions)
      .where(and(eq(sessions.userId, user.id), ne(sessions.id, user.sessionId)));
    await writeAudit(db, {
      action: AuditAction.SessionRevoke,
      actor: { id: user.id, email: user.email },
      target: `user:${user.id}`,
      summary: { scope: 'others' },
    });
    return ok(undefined, 'All other sessions were signed out.');
  });
}
