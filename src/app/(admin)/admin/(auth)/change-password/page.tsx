import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthCard } from '@/admin/components/auth/auth-card';
import { ChangePasswordForm } from '@/admin/components/auth/change-password-form';
import { Button } from '@/admin/ui/button';
import { signOutAction } from '@/core/auth/actions';
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
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Signed in as <strong className="text-foreground">{user.email}</strong>
        </p>
        <ChangePasswordForm redirectTo={adminHref(AdminRoute.Overview)} />
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" className="w-full">
            Sign out and go back to sign in
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}
