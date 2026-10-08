import { redirect } from 'next/navigation';

import { AuthCard } from '@/admin/components/auth/auth-card';
import { LoginForm } from '@/admin/components/auth/login-form';
import { getCurrentUser } from '@/core/auth/server/session';
import { safeRedirectPath } from '@/core/project/paths';
import { readSiteSettings } from '@/core/settings/repository';
import { getDb } from '@/core/db/client';

export const instant = false;

/**
 * Private mode: visitors sign in with an active admin/manager account, then
 * return to the page they requested.
 */
export default async function AccessPage({ searchParams }: PageProps<'/access'>) {
  const { next } = await searchParams;
  const target = safeRedirectPath(next, '/');
  const user = await getCurrentUser();
  if (user) redirect(`/api/gate/continue?next=${encodeURIComponent(target)}`);
  const { general } = await readSiteSettings(await getDb());
  return (
    <AuthCard title={general.siteName} description="This site is private. Sign in to continue.">
      <LoginForm next={target} />
    </AuthCard>
  );
}
