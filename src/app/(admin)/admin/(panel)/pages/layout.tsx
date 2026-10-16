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
import { getRequestSettings } from '@/core/settings/request';
import { timed } from '@/core/perf/timing';
import { selectedLocales } from '@/core/i18n/language-state';

export const instant = false;

function toTreeNode(node: PageTreeNode): TreeNode {
  return {
    id: node.page.id,
    label: node.page.label,
    path: node.page.path,
    children: node.children.map(toTreeNode),
  };
}

/**
 * Pages area: secondary sidebar with the page tree next to the editor. The
 * tree streams in its own Suspense boundary, so a click shows the editor's
 * loading state immediately instead of waiting for the tree's queries.
 */
export default async function PagesLayout({ children }: LayoutProps<'/admin/pages'>) {
  await requirePermission(Permission.PagesView);
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Suspense fallback={<TreeSkeleton />}>
          <PagesSidebar />
        </Suspense>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function TreeSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-9 w-full" />
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <Skeleton key={index} className="h-7 w-full" />
      ))}
    </div>
  );
}

/** Page tree with per-locale completeness, item counts and unread requests. */
async function PagesSidebar() {
  const db = await getDb();
  const { general } = await getRequestSettings();
  const [statuses, itemCounts, unread] = await timed('db:tree', () =>
    Promise.all([
      loadPageStatuses(db, selectedLocales(general)),
      countItems(
        db,
        contentRegistry.collections.map((collection) => collection.id),
      ),
      countNew(
        db,
        contentRegistry.forms.map((form) => form.id),
      ),
    ]),
  );
  const groups: SidebarGroup[] = [];
  if (contentRegistry.collections.length > 0) {
    groups.push({
      id: PagesArea.Collections,
      title: 'Blog & lists',
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

  // Layout chrome (globals) and sections shared by several pages.
  const everyPage = [
    ...contentRegistry.globals.map((global) => ({
      id: global.id,
      label: global.label,
      href: pagesAreaHref(PagesArea.SiteWide, global.id),
    })),
    ...contentRegistry.sharedSections.map((shared) => {
      const pages = contentRegistry.pagesUsingShared(shared.id).length;
      return {
        id: `shared-${shared.id}`,
        label: shared.label,
        href: pagesAreaHref(PagesArea.Shared, shared.id),
        note: `Used on ${pages} ${pages === 1 ? 'page' : 'pages'}`,
      };
    }),
  ];
  if (everyPage.length > 0) {
    groups.push({ id: PagesArea.SiteWide, title: 'Every page', items: everyPage });
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
    <PagesTree
      tree={registry.tree().map(toTreeNode)}
      statuses={statuses}
      locales={selectedLocales(general)}
      groups={groups}
    />
  );
}
