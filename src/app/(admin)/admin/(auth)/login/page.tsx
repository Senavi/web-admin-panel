import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthCard } from '@/admin/components/auth/auth-card';
import { LoginForm } from '@/admin/components/auth/login-form';
import { Alert, AlertDescription, AlertTitle } from '@/admin/ui/alert';
import { Button } from '@/admin/ui/button';
import { signOutAction } from '@/core/auth/actions';
import { getCurrentUser } from '@/core/auth/server/session';
import { adminHref, AdminRoute, safeRedirectPath } from '@/core/project/paths';
import { projectConfig } from '@project/config';

export const metadata: Metadata = { title: 'Sign in' };
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<'/admin/login'>) {
  const { next } = await searchParams;
  const target = safeRedirectPath(next, adminHref(AdminRoute.Overview));
  const user = await getCurrentUser();
  // Fully signed in: straight on. Someone who still has to choose a new password stays
  // here (no redirect loop to change-password) and can continue or switch account.
  if (user && !user.mustChangePassword) redirect(target);
  return (
    <AuthCard title="Sign in" description={`Sign in to manage ${projectConfig.name}.`}>
      {user ? (
        <Alert className="mb-4">
          <AlertTitle>You’re signed in as {user.email}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>You need to choose a new password before you continue.</span>
            <span className="flex flex-wrap gap-2">
              <Button
                nativeButton={false}
                render={<Link href={adminHref(AdminRoute.ChangePassword)} />}
              >
                Continue
              </Button>
              <form action={signOutAction}>
                <Button type="submit" variant="outline">
                  Use another account
                </Button>
              </form>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}
      <LoginForm next={target} />
    </AuthCard>
  );
}
