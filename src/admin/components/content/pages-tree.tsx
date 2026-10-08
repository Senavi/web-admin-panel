'use client';

import { FileTextIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { cn } from '@/admin/lib/utils';
import { Input } from '@/admin/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/admin/ui/tooltip';
import type { LocaleStatus } from '@/core/content/editor-types';
import { adminHref, AdminRoute } from '@/core/project/paths';

export interface TreeNode {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly children: readonly TreeNode[];
}

const STATUS_CLASS: Record<LocaleStatus, string> = {
  complete: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  incomplete: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  missing: 'bg-muted text-muted-foreground',
};
const STATUS_LABEL: Record<LocaleStatus, string> = {
  complete: 'All required fields are filled',
  incomplete: 'Some required fields are empty',
  missing: 'Not translated yet (uses the default language)',
};

function matches(node: TreeNode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    node.label.toLowerCase().includes(q) ||
    node.path.includes(q) ||
    node.children.some((child) => matches(child, q))
  );
}

/** Searchable tree of all pages and sub-pages with per-locale completeness. */
export function PagesTree({
  tree,
  statuses,
  locales,
}: {
  tree: readonly TreeNode[];
  statuses: Readonly<Record<string, Readonly<Record<string, LocaleStatus>>>>;
  locales: readonly string[];
}) {
  const [query, setQuery] = useState('');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLocale = searchParams.get('locale');
  const visible = useMemo(() => tree.filter((node) => matches(node, query)), [tree, query]);

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
          <span className="flex gap-0.5">
            {locales.map((locale) => {
              const status = statuses[node.id]?.[locale] ?? 'missing';
              return (
                <Tooltip key={locale}>
                  <TooltipTrigger
                    render={<span />}
                    className={cn(
                      'rounded font-semibold px-1 text-[10px] uppercase',
                      STATUS_CLASS[status],
                    )}
                    aria-label={`${locale}: ${STATUS_LABEL[status]}`}
                    data-status={status}
                  >
                    {locale}
                  </TooltipTrigger>
                  <TooltipContent>{STATUS_LABEL[status]}</TooltipContent>
                </Tooltip>
              );
            })}
          </span>
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
      {visible.length === 0 ? (
        <p className="text-sm px-2 text-muted-foreground">No pages match.</p>
      ) : null}
      <ul className="flex flex-col gap-0.5">{tree.map((node) => renderNode(node, 0))}</ul>
    </nav>
  );
}
