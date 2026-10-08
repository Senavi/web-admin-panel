import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { AuthCard } from '@/admin/components/auth/auth-card';
import { LoginForm } from '@/admin/components/auth/login-form';
import { getCurrentUser } from '@/core/auth/server/session';
import { adminHref, AdminRoute, safeRedirectPath } from '@/core/project/paths';
import { projectConfig } from '@project/config';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage({ searchParams }: PageProps<'/admin/login'>) {
  return (
    <AuthCard title="Sign in" description={`Sign in to manage ${projectConfig.name}.`}>
      <Suspense>
        <LoginFormLoader searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginFormLoader({ searchParams }: Pick<PageProps<'/admin/login'>, 'searchParams'>) {
  const { next } = await searchParams;
  const target = safeRedirectPath(next, adminHref(AdminRoute.Overview));
  if (await getCurrentUser()) redirect(target);
  return <LoginForm next={target} />;
}
