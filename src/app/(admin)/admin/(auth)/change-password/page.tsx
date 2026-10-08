import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthCard } from '@/admin/components/auth/auth-card';
import { ChangePasswordForm } from '@/admin/components/auth/change-password-form';
import { requireUser } from '@/core/auth/server/session';
import { adminHref, AdminRoute } from '@/core/project/paths';

export const metadata: Metadata = { title: 'Change password' };
export const instant = false;

/** Forced password change after signing in with a temporary password. */
export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPendingPasswordChange: true });
  if (!user.mustChangePassword) redirect(adminHref(AdminRoute.Overview));
  return (
    <AuthCard
      title="Choose a new password"
      description="You signed in with a temporary password. Choose a new one to continue."
    >
      <ChangePasswordForm redirectTo={adminHref(AdminRoute.Overview)} />
    </AuthCard>
  );
}
