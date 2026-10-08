import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthCard } from '@/admin/components/auth/auth-card';
import { LoginForm } from '@/admin/components/auth/login-form';
import { getCurrentUser } from '@/core/auth/server/session';
import { adminHref, AdminRoute, safeRedirectPath } from '@/core/project/paths';
import { projectConfig } from '@project/config';

export const metadata: Metadata = { title: 'Sign in' };
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<'/admin/login'>) {
  const { next } = await searchParams;
  const target = safeRedirectPath(next, adminHref(AdminRoute.Overview));
  if (await getCurrentUser()) redirect(target);
  return (
    <AuthCard title="Sign in" description={`Sign in to manage ${projectConfig.name}.`}>
      <LoginForm next={target} />
    </AuthCard>
  );
}
