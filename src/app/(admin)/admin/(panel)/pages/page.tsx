import type { Metadata } from 'next';

import { PageHeader } from '@/admin/components/layout/page-header';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';

export const metadata: Metadata = { title: 'Pages' };
export const instant = false;

export default async function PagesPage() {
  await requirePermission(Permission.PagesView);
  return <PageHeader title="Pages" description="Edit page content and SEO." />;
}
