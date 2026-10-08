import { Suspense } from 'react';

import { PagesTree, type TreeNode } from '@/admin/components/content/pages-tree';
import { Skeleton } from '@/admin/ui/skeleton';
import { registry } from '@/content';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import { loadPageStatuses } from '@/core/content/editor';
import type { PageTreeNode } from '@/core/content/registry';
import { getDb } from '@/core/db/client';
import { readSiteSettings } from '@/core/settings/repository';

export const instant = false;

function toTreeNode(node: PageTreeNode): TreeNode {
  return {
    id: node.page.id,
    label: node.page.label,
    path: node.page.path,
    children: node.children.map(toTreeNode),
  };
}

/** Pages area: secondary sidebar with the page tree next to the editor. */
export default async function PagesLayout({ children }: LayoutProps<'/admin/pages'>) {
  await requirePermission(Permission.PagesView);
  const db = await getDb();
  const { general } = await readSiteSettings(db);
  const statuses = await loadPageStatuses(db, general.enabledLocales);

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        {/* useSearchParams in the tree needs a Suspense boundary. */}
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <PagesTree
            tree={registry.tree().map(toTreeNode)}
            statuses={statuses}
            locales={general.enabledLocales}
          />
        </Suspense>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
