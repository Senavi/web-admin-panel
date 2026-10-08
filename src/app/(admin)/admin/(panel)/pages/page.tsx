import { FileTextIcon } from 'lucide-react';
import type { Metadata } from 'next';

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/admin/ui/empty';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';

export const metadata: Metadata = { title: 'Pages' };
export const instant = false;

export default async function PagesIndexPage() {
  await requirePermission(Permission.PagesView);
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileTextIcon />
        </EmptyMedia>
        <EmptyTitle>
          <h1>Pages</h1>
        </EmptyTitle>
        <EmptyDescription>Select a page on the left to edit its content and SEO.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
