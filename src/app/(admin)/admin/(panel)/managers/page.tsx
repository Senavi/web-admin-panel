import { asc } from 'drizzle-orm';
import type { Metadata } from 'next';

import { PageHeader } from '@/admin/components/layout/page-header';
import { UsersTable } from '@/admin/components/managers/users-table';
import { Permission } from '@/core/auth/permissions';
import { isRole } from '@/core/auth/roles';
import { requirePermission } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import { users } from '@/core/db/schema';

export const metadata: Metadata = { title: 'Managers' };
export const instant = false;

export default async function ManagersPage() {
  const me = await requirePermission(Permission.ManagersManage);
  const rows = await (await getDb()).select().from(users).orderBy(asc(users.name));
  return (
    <>
      <PageHeader
        title="Managers"
        description="Admins can do everything; managers can edit pages and see the overview."
      />
      <UsersTable
        currentUserId={me.id}
        users={rows.flatMap((row) =>
          isRole(row.role)
            ? [
                {
                  id: row.id,
                  name: row.name,
                  email: row.email,
                  role: row.role,
                  status: row.status,
                  twoFactorEnabled: row.twoFactorEnabled,
                  lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
                  createdAt: row.createdAt.toISOString(),
                },
              ]
            : [],
        )}
      />
    </>
  );
}
