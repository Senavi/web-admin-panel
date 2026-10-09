import { Suspense } from 'react';

import { PagesTree, type SidebarGroup, type TreeNode } from '@/admin/components/content/pages-tree';
import { Skeleton } from '@/admin/ui/skeleton';
import { registry } from '@/content';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import { countItems } from '@/core/collections/admin';
import { countNew } from '@/core/forms/inbox';
import { loadPageStatuses } from '@/core/content/editor';
import { contentRegistry } from '@/core/content/project-registry';
import type { PageTreeNode } from '@/core/content/registry';
import { getDb } from '@/core/db/client';
import { PagesArea, pagesAreaHref } from '@/core/project/paths';
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
  const [statuses, itemCounts, unread] = await Promise.all([
    loadPageStatuses(db, general.enabledLocales),
    countItems(
      db,
      contentRegistry.collections.map((collection) => collection.id),
    ),
    countNew(
      db,
      contentRegistry.forms.map((form) => form.id),
    ),
  ]);
  const groups: SidebarGroup[] = [];
  if (contentRegistry.collections.length > 0) {
    groups.push({
      id: PagesArea.Collections,
      title: 'Collections',
      items: contentRegistry.collections.map((collection) => {
        const count = itemCounts[collection.id] ?? 0;
        return {
          id: collection.id,
          label: collection.label,
          href: pagesAreaHref(PagesArea.Collections, collection.id),
          count,
          countLabel: `${count} item${count === 1 ? '' : 's'}`,
        };
      }),
    });
  }

  if (contentRegistry.globals.length > 0) {
    groups.push({
      id: PagesArea.SiteWide,
      title: 'Site-wide',
      items: contentRegistry.globals.map((global) => ({
        id: global.id,
        label: global.label,
        href: pagesAreaHref(PagesArea.SiteWide, global.id),
      })),
    });
  }

  if (contentRegistry.forms.length > 0) {
    groups.push({
      id: PagesArea.Forms,
      title: 'Forms',
      items: contentRegistry.forms.map((form) => {
        const count = unread[form.id] ?? 0;
        return {
          id: form.id,
          label: form.label,
          href: pagesAreaHref(PagesArea.Forms, form.id),
          ...(count > 0 ? { count, countLabel: `${count} new` } : {}),
        };
      }),
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        {/* useSearchParams in the tree needs a Suspense boundary. */}
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <PagesTree
            tree={registry.tree().map(toTreeNode)}
            statuses={statuses}
            locales={general.enabledLocales}
            groups={groups}
          />
        </Suspense>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
