import 'server-only';

import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

import { getDb } from '@/core/db/client';
import { adminHref, AdminRoute } from '@/core/project/paths';
import { readSiteSettings } from '@/core/settings/repository';

import { can, Permission } from '../permissions';
import { isRole, Role, UserStatus } from '../roles';
import { getAuth } from './instance';

export interface CurrentUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly mustChangePassword: boolean;
  readonly twoFactorEnabled: boolean;
  readonly sessionVersion: number;
  readonly sessionId: string;
}

/** Thrown by `assertPermission` in server actions and route handlers. */
export class AuthorizationError extends Error {
  constructor(message = 'You are not allowed to perform this action.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/** The signed-in, active user for this request (deduplicated per request), or null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Read request headers first so prerendering stops here before touching the database.
  const requestHeaders = await headers();
  const auth = await getAuth();
  const result = await auth.api.getSession({ headers: requestHeaders });
  if (!result) return null;
  const { user, session } = result;
  if (user.status !== UserStatus.Active || !isRole(user.role)) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    twoFactorEnabled: user.twoFactorEnabled === true,
    sessionVersion: user.sessionVersion,
    sessionId: session.id,
  };
});

export interface RequireUserOptions {
  /** The forced password-change screen itself. */
  readonly allowPendingPasswordChange?: boolean;
  /** The Account page, where 2FA is set up when the policy requires it. */
  readonly allowMissingTwoFactor?: boolean;
}

/**
 * Page guard: redirects to login when signed out, to the forced password-change
 * screen while a temporary password is in use, and to Account → 2FA when the
 * security policy requires 2FA for admins and it is not set up yet.
 */
export async function requireUser(options: RequireUserOptions = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(adminHref(AdminRoute.Login));
  if (user.mustChangePassword && !options.allowPendingPasswordChange) {
    redirect(adminHref(AdminRoute.ChangePassword));
  }
  if (!options.allowMissingTwoFactor && (await mustSetUpTwoFactor(user))) {
    redirect(`${adminHref(AdminRoute.Account)}#two-factor`);
  }
  return user;
}

async function mustSetUpTwoFactor(user: CurrentUser): Promise<boolean> {
  if (user.role !== Role.Admin || user.twoFactorEnabled) return false;
  const { security } = await readSiteSettings(await getDb());
  return security.requireTwoFactorForAdmins;
}

/** Page guard: the route does not exist for users without the permission. */
export async function requirePermission(
  permission: Permission,
  options: RequireUserOptions = {},
): Promise<CurrentUser> {
  const user = await requireUser(options);
  if (!can(user.role, permission)) notFound();
  return user;
}

/** Action / route handler guard. Throws `AuthorizationError` instead of redirecting. */
export async function assertPermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !can(user.role, permission)) {
    throw new AuthorizationError();
  }
  if (permission !== Permission.AccountManage && (await mustSetUpTwoFactor(user))) {
    throw new AuthorizationError(
      'Set up two-factor authentication first (required by the security policy).',
    );
  }
  return user;
}

/** Action guard for the signed-in user's own account (allowed during forced password change). */
export async function assertSignedIn(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError('Your session has expired. Sign in again.');
  return user;
}
