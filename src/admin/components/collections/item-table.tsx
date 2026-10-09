import Link from 'next/link';

import { formatDate, formatDateTime } from '@/admin/lib/format';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { Input } from '@/admin/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/ui/table';
import {
  type ItemTable as ItemTableData,
  type ItemTableQuery,
  ItemSort,
  STATUS_FILTER_ALL,
} from '@/core/collections/admin';
import { CollectionItemStatus } from '@/core/content/collection';

import { LocaleStatusChips } from '../content/locale-status';

const STATUS_LABEL: Record<CollectionItemStatus, string> = {
  [CollectionItemStatus.Draft]: 'Draft',
  [CollectionItemStatus.Published]: 'Published',
};

const SORT_LABEL: Record<ItemSort, string> = {
  [ItemSort.Updated]: 'Recently updated',
  [ItemSort.Published]: 'Publish date',
  [ItemSort.Title]: 'Title',
};

const SELECT_CLASS = 'text-sm h-9 rounded-md border bg-transparent px-2';

/** Server-rendered, URL-driven item table (search, status filter, sort, pagination). */
export function ItemTable({
  table,
  query,
  basePath,
  locales,
  itemLabel,
  untitled,
}: {
  table: ItemTableData;
  query: ItemTableQuery;
  basePath: string;
  locales: readonly string[];
  itemLabel: string;
  untitled: string;
}) {
  const href = (page: number) =>
    `${basePath}?${new URLSearchParams({
      q: query.search,
      status: query.status,
      sort: query.sort,
      page: String(page),
    }).toString()}`;
  return (
    <div className="flex flex-col gap-3">
      <form
        method="get"
        action={basePath}
        className="flex flex-wrap items-center gap-2"
        aria-label="Filter items"
      >
        <Input
          type="search"
          name="q"
          defaultValue={query.search}
          placeholder="Search by title"
          aria-label="Search by title"
          className="max-w-64"
        />
        <select
          name="status"
          defaultValue={query.status}
          aria-label="Status"
          className={SELECT_CLASS}
        >
          <option value={STATUS_FILTER_ALL}>All statuses</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={query.sort} aria-label="Sort" className={SELECT_CLASS}>
          {Object.entries(SORT_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
      </form>

      <Table aria-label={`${itemLabel} list`}>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Languages</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-sm py-8 text-center text-muted-foreground">
                Nothing here yet.
              </TableCell>
            </TableRow>
          ) : (
            table.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-80">
                  <Link href={`${basePath}/${row.id}`} className="font-medium hover:underline">
                    {row.title || untitled}
                  </Link>
                  <p className="text-xs truncate font-mono text-muted-foreground">{row.slug}</p>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      row.status === CollectionItemStatus.Published ? 'default' : 'secondary'
                    }
                  >
                    {STATUS_LABEL[row.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {row.publishedAt ? formatDate(row.publishedAt) : '—'}
                </TableCell>
                <TableCell>
                  <LocaleStatusChips locales={locales} statuses={row.statuses} />
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                  {formatDateTime(row.updatedAt)}
                  {row.updatedBy ? <span className="text-xs block">{row.updatedBy}</span> : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {table.pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            Page {table.page} of {table.pageCount} · {table.total} items
          </span>
          <span className="flex gap-2">
            {table.page > 1 ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={href(table.page - 1)} />}
              >
                Previous
              </Button>
            ) : null}
            {table.page < table.pageCount ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={href(table.page + 1)} />}
              >
                Next
              </Button>
            ) : null}
          </span>
        </nav>
      ) : null}
    </div>
  );
}
