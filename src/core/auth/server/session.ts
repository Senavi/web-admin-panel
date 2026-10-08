import 'server-only';

import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

import { adminHref, AdminRoute } from '@/core/project/paths';

import { can, type Permission } from '../permissions';
import { isRole, type Role, UserStatus } from '../roles';
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

/**
 * Page guard: redirects to login when signed out, and to the forced
 * password-change screen while a temporary password is in use.
 */
export async function requireUser(options: { allowPendingPasswordChange?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect(adminHref(AdminRoute.Login));
  if (user.mustChangePassword && !options.allowPendingPasswordChange) {
    redirect(adminHref(AdminRoute.ChangePassword));
  }
  return user;
}

/** Page guard: the route does not exist for users without the permission. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) notFound();
  return user;
}

/** Action / route handler guard. Throws `AuthorizationError` instead of redirecting. */
export async function assertPermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !can(user.role, permission)) {
    throw new AuthorizationError();
  }
  return user;
}

/** Action guard for the signed-in user's own account (allowed during forced password change). */
export async function assertSignedIn(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError('Your session has expired. Sign in again.');
  return user;
}
