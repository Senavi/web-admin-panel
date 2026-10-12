import { FileTextIcon } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader } from '@/admin/components/layout/page-header';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/admin/ui/empty';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';

export const metadata: Metadata = { title: 'Pages' };
export const instant = false;

export default async function PagesIndexPage() {
  await requirePermission(Permission.PagesView);
  return (
    <>
      <PageHeader title="Pages" description="Texts, pictures, blog, forms and requests." />
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileTextIcon />
          </EmptyMedia>
          <EmptyTitle>Choose a page</EmptyTitle>
          <EmptyDescription>
            Choose a page on the left to edit its texts, pictures and how it looks in Google.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </>
  );
}
