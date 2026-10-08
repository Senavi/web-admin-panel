import type { Metadata } from 'next';

import { PageHeader } from '@/admin/components/layout/page-header';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';

export const metadata: Metadata = { title: 'Settings' };
export const instant = false;

export default async function SettingsPage() {
  await requirePermission(Permission.SettingsManage);
  return <PageHeader title="Settings" description="Site-wide configuration." />;
}
