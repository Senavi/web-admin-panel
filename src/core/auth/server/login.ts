import 'server-only';

import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';

import { getDb } from '@/core/db/client';
import { users } from '@/core/db/schema';
import { AuditAction, writeAudit } from '@/core/security/audit';
import { getClientIp, hashIp } from '@/core/security/request';
import { issueGateCookie } from '@/core/site-gate/cookie';

import { isRole, UserStatus } from '../roles';
import { getAuth } from './instance';
import { isLocked, recordFailure, recordSuccess, throttleKeys, type ThrottleKey } from './throttle';
import { normalizeEmail } from './users';

/** Generic messages: never reveal whether the email exists or which factor failed. */
export const LoginMessage = {
  Invalid: 'Invalid email or password.',
  InvalidCode: 'Invalid verification code.',
  Locked: 'Too many failed attempts. Please wait a few minutes and try again.',
  Expired: 'Your sign-in attempt expired. Please start again.',
} as const;

export type LoginOutcome =
  | { readonly status: 'success'; readonly userId: string }
  | { readonly status: 'two-factor' }
  | { readonly status: 'error'; readonly message: string };

interface LoginContext {
  readonly requestHeaders: Headers;
  readonly ipHash: string | null;
  readonly keys: ThrottleKey[];
}

async function loginContext(email: string): Promise<LoginContext> {
  const requestHeaders = await headers();
  const ipHash = await hashIp(getClientIp(requestHeaders));
  return { requestHeaders, ipHash, keys: throttleKeys(email, ipHash) };
}

/** Step 1: email + password. May require a second (TOTP) step. */
export async function signInWithPassword(
  emailInput: string,
  password: string,
): Promise<LoginOutcome> {
  const email = normalizeEmail(emailInput);
  const db = await getDb();
  const auth = await getAuth();
  const ctx = await loginContext(email);

  if (await isLocked(db, ctx.keys)) {
    await writeAudit(db, {
      action: AuditAction.LoginLocked,
      target: `email:${email}`,
      ipHash: ctx.ipHash,
    });
    return { status: 'error', message: LoginMessage.Locked };
  }

  try {
    const result = await auth.api.signInEmail({
      body: { email, password, rememberMe: true },
      headers: ctx.requestHeaders,
    });
    if ('twoFactorRedirect' in result && result.twoFactorRedirect) {
      return { status: 'two-factor' };
    }
    if (!('user' in result)) throw new Error('Unexpected sign-in response.');
    return completeLogin(result.user.id, ctx);
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    return failLogin(email, ctx);
  }
}

/** Step 2: TOTP code or backup code, after a successful password step. */
export async function verifySecondFactor(
  code: string,
  method: 'totp' | 'backup',
): Promise<LoginOutcome> {
  const db = await getDb();
  const auth = await getAuth();
  const requestHeaders = await headers();
  const ipHash = await hashIp(getClientIp(requestHeaders));
  const ipKeys = throttleKeys('', ipHash).filter((key) => key.key.startsWith('ip:'));

  if (await isLocked(db, ipKeys)) return { status: 'error', message: LoginMessage.Locked };

  try {
    const result =
      method === 'totp'
        ? await auth.api.verifyTOTP({ body: { code, trustDevice: false }, headers: requestHeaders })
        : await auth.api.verifyBackupCode({ body: { code }, headers: requestHeaders });
    const userId = result.user.id;
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    return completeLogin(userId, {
      requestHeaders,
      ipHash,
      keys: throttleKeys(user?.email ?? '', ipHash),
    });
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    await recordFailure(db, ipKeys);
    await writeAudit(db, { action: AuditAction.LoginFailure, target: 'two-factor', ipHash });
    return { status: 'error', message: LoginMessage.InvalidCode };
  }
}

async function failLogin(email: string, ctx: LoginContext): Promise<LoginOutcome> {
  const db = await getDb();
  const locked = await recordFailure(db, ctx.keys);
  await writeAudit(db, {
    action: locked ? AuditAction.LoginLocked : AuditAction.LoginFailure,
    target: `email:${email}`,
    ipHash: ctx.ipHash,
  });
  return { status: 'error', message: locked ? LoginMessage.Locked : LoginMessage.Invalid };
}

async function completeLogin(userId: string, ctx: LoginContext): Promise<LoginOutcome> {
  const db = await getDb();
  const [user] = await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!user || user.status !== UserStatus.Active || !isRole(user.role)) {
    return { status: 'error', message: LoginMessage.Invalid };
  }
  await recordSuccess(db, ctx.keys);
  await issueGateCookie({ id: user.id, role: user.role, sessionVersion: user.sessionVersion });
  await writeAudit(db, {
    action: AuditAction.LoginSuccess,
    actor: { id: user.id, email: user.email },
    target: `user:${user.id}`,
    ipHash: ctx.ipHash,
  });
  return { status: 'success', userId: user.id };
}
