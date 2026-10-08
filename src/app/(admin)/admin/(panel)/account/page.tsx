import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ProfileForm } from '@/admin/components/account/profile-form';
import { SessionsList } from '@/admin/components/account/sessions-list';
import { TwoFactorCard } from '@/admin/components/account/two-factor-card';
import { ChangePasswordForm } from '@/admin/components/auth/change-password-form';
import { PageHeader } from '@/admin/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/ui/card';
import { Skeleton } from '@/admin/ui/skeleton';
import { Permission } from '@/core/auth/permissions';
import { Role } from '@/core/auth/roles';
import { requirePermission } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import { sessions } from '@/core/db/schema';
import { readSiteSettings } from '@/core/settings/repository';

export const metadata: Metadata = { title: 'Account' };

export default function AccountPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Account"
        description="Your profile, password, two-factor authentication and sessions."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AccountContent />
      </Suspense>
    </div>
  );
}

async function AccountContent() {
  const user = await requirePermission(Permission.AccountManage);
  const db = await getDb();
  const [{ security }, sessionRows] = await Promise.all([
    readSiteSettings(db),
    db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))
      .orderBy(desc(sessions.createdAt)),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard title="Profile" description="Your name as shown to other admins.">
        <ProfileForm name={user.name} email={user.email} />
      </SectionCard>
      <SectionCard
        title="Password"
        description="Changing your password signs out your other sessions."
      >
        <ChangePasswordForm />
      </SectionCard>
      <SectionCard
        title="Two-factor authentication"
        description="Protect your account with an authenticator app."
      >
        <TwoFactorCard
          enabled={user.twoFactorEnabled}
          required={security.requireTwoFactorForAdmins && user.role === Role.Admin}
        />
      </SectionCard>
      <SectionCard title="Active sessions" description="Devices where you are signed in.">
        <SessionsList
          sessions={sessionRows.map((session) => ({
            id: session.id,
            userAgent: session.userAgent,
            createdAt: session.createdAt.toISOString(),
            expiresAt: session.expiresAt.toISOString(),
            current: session.id === user.sessionId,
          }))}
        />
      </SectionCard>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
