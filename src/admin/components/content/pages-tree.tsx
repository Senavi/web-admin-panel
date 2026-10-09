'use client';

import { FileTextIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { cn } from '@/admin/lib/utils';
import { Input } from '@/admin/ui/input';
import type { LocaleStatus } from '@/core/content/editor-types';
import { adminHref, AdminRoute } from '@/core/project/paths';

import { LocaleStatusChips } from './locale-status';

/** Extra sidebar group (Collections, Site-wide, Forms): flat links with an optional count. */
export interface SidebarGroup {
  readonly id: string;
  readonly title: string;
  readonly items: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly href: string;
    /** Shown as a badge, e.g. item or unread count. */
    readonly count?: number;
    readonly countLabel?: string;
  }>;
}

export interface TreeNode {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly children: readonly TreeNode[];
}

function matches(node: TreeNode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    node.label.toLowerCase().includes(q) ||
    node.path.includes(q) ||
    node.children.some((child) => matches(child, q))
  );
}

/**
 * Searchable Pages sidebar: the page tree with per-locale completeness, then
 * the collections / site-wide / forms groups. Search filters every group.
 */
export function PagesTree({
  tree,
  statuses,
  locales,
  groups = [],
}: {
  tree: readonly TreeNode[];
  statuses: Readonly<Record<string, Readonly<Record<string, LocaleStatus>>>>;
  locales: readonly string[];
  groups?: readonly SidebarGroup[];
}) {
  const [query, setQuery] = useState('');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLocale = searchParams.get('locale');
  const visible = useMemo(() => tree.filter((node) => matches(node, query)), [tree, query]);
  const needle = query.trim().toLowerCase();
  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !needle || item.label.toLowerCase().includes(needle)),
        }))
        .filter((group) => group.items.length > 0),
    [groups, needle],
  );

  const renderNode = (node: TreeNode, depth: number) => {
    if (!matches(node, query)) return null;
    const href = `${adminHref(AdminRoute.Pages)}/${node.id}${currentLocale ? `?locale=${currentLocale}` : ''}`;
    const active = pathname === `${adminHref(AdminRoute.Pages)}/${node.id}`;
    return (
      <li key={node.id}>
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'text-sm hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5',
            active && 'bg-muted font-medium',
          )}
          style={{ paddingInlineStart: `${0.5 + depth * 1}rem` }}
        >
          <FileTextIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{node.label}</span>
          <LocaleStatusChips locales={locales} statuses={statuses[node.id]} />
        </Link>
        {node.children.length > 0 ? (
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        ) : null}
      </li>
    );
  };

  return (
    <nav aria-label="Pages" className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pages"
          aria-label="Search pages"
          className="ps-8"
        />
      </div>
      {visible.length === 0 && visibleGroups.length === 0 ? (
        <p className="text-sm px-2 text-muted-foreground">Nothing matches.</p>
      ) : null}
      {groups.length > 0 && visible.length > 0 ? <GroupTitle>Pages</GroupTitle> : null}
      <ul className="flex flex-col gap-0.5">{tree.map((node) => renderNode(node, 0))}</ul>
      {visibleGroups.map((group) => (
        <section key={group.id} aria-label={group.title} className="flex flex-col gap-0.5">
          <GroupTitle>{group.title}</GroupTitle>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'text-sm hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5',
                      active && 'bg-muted font-medium',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.count !== undefined ? (
                      <span
                        className="text-xs bg-muted rounded-full px-1.5 text-muted-foreground tabular-nums"
                        aria-label={item.countLabel ?? `${item.count}`}
                      >
                        {item.count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

function GroupTitle({ children }: { children: string }) {
  return (
    <h2 className="text-xs font-medium tracking-wide px-2 pt-2 text-muted-foreground uppercase">
      {children}
    </h2>
  );
}
