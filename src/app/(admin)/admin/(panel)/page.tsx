import type { Metadata } from 'next';

import { PageHeader } from '@/admin/components/layout/page-header';

export const metadata: Metadata = { title: 'Overview' };

export default function OverviewPage() {
  return <PageHeader title="Overview" description="Site analytics and status." />;
}
