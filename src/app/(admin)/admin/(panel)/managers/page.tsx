import type { Metadata } from 'next';

import { PageHeader } from '@/admin/components/layout/page-header';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';

export const metadata: Metadata = { title: 'Managers' };
export const instant = false;

export default async function ManagersPage() {
  await requirePermission(Permission.ManagersManage);
  return <PageHeader title="Managers" description="Manage admin and manager accounts." />;
}
