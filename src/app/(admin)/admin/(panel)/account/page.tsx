import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';

import { DeveloperModeCard } from '@/admin/components/account/developer-mode-card';
import { ProfileForm } from '@/admin/components/account/profile-form';
import { SessionsList } from '@/admin/components/account/sessions-list';
import { TwoFactorCard } from '@/admin/components/account/two-factor-card';
import { ChangePasswordForm } from '@/admin/components/auth/change-password-form';
import { PageHeader } from '@/admin/components/layout/page-header';
import { SectionList } from '@/admin/components/layout/accordion';
import { Permission } from '@/core/auth/permissions';
import { Role } from '@/core/auth/roles';
import { requirePermission } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import { sessions } from '@/core/db/schema';
import { getRequestSettings } from '@/core/settings/request';

export const metadata: Metadata = { title: 'Account' };
export const instant = false;

export default async function AccountPage() {
  const user = await requirePermission(Permission.AccountManage, {
    allowMissingTwoFactor: true,
  });
  const db = await getDb();
  const [{ security }, sessionRows] = await Promise.all([
    getRequestSettings(),
    db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))
      .orderBy(desc(sessions.createdAt)),
  ]);

  const twoFactorRequired = security.requireTwoFactorForAdmins && user.role === Role.Admin;

  return (
    <>
      <PageHeader
        title="Account"
        description="Your profile, password, two-factor sign-in and devices."
      />
      <div className="max-w-3xl">
        <SectionList
          openId={twoFactorRequired && !user.twoFactorEnabled ? 'two-factor' : undefined}
          sections={[
            {
              id: 'profile',
              title: 'Profile',
              description: 'Your name as shown to other admins.',
              summary: `${user.name} · ${user.email}`,
              content: <ProfileForm name={user.name} email={user.email} />,
            },
            {
              id: 'password',
              title: 'Password',
              description: 'Changing your password signs out your other devices.',
              summary: 'Change your password',
              content: <ChangePasswordForm />,
            },
            {
              id: 'two-factor',
              title: 'Two-factor authentication',
              description: 'Protect your account with an authenticator app.',
              summary: user.twoFactorEnabled ? 'On' : 'Off',
              content: (
                <TwoFactorCard enabled={user.twoFactorEnabled} required={twoFactorRequired} />
              ),
            },
            {
              id: 'sessions',
              title: 'Signed-in devices',
              description: 'Devices where you are signed in.',
              summary: `${sessionRows.length} ${sessionRows.length === 1 ? 'device' : 'devices'}`,
              content: (
                <SessionsList
                  sessions={sessionRows.map((session) => ({
                    id: session.id,
                    userAgent: session.userAgent,
                    createdAt: session.createdAt.toISOString(),
                    expiresAt: session.expiresAt.toISOString(),
                    current: session.id === user.sessionId,
                  }))}
                />
              ),
            },
            {
              id: 'developer-mode',
              title: 'Developer mode',
              summary: user.developerMode ? 'On: technical settings are shown' : 'Off',
              content: <DeveloperModeCard />,
            },
          ]}
        />
      </div>
    </>
  );
}
