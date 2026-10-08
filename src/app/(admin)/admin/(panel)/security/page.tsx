import type { Metadata } from 'next';

import { PageHeader } from '@/admin/components/layout/page-header';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';

export const metadata: Metadata = { title: 'Security' };
export const instant = false;

export default async function SecurityPage() {
  await requirePermission(Permission.SecurityManage);
  return (
    <PageHeader
      title="Security"
      description="Database, storage, environment, sessions and audit log."
    />
  );
}
