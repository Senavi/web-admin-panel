import { DownloadIcon } from 'lucide-react';
import Link from 'next/link';

import { formatDateTime } from '@/admin/lib/format';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/admin/ui/card';
import { Input } from '@/admin/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/ui/table';
import type { DeliveryState } from '@/core/db/schema';
import { type Inbox, InboxFilter, SubmissionStatus } from '@/core/forms/inbox';

import { SubmissionActions } from './submission-actions';

const FILTER_LABEL: Record<InboxFilter, string> = {
  [InboxFilter.Open]: 'Inbox (new and read)',
  [InboxFilter.New]: 'New',
  [InboxFilter.Read]: 'Read',
  [InboxFilter.Archived]: 'Archived',
  [InboxFilter.All]: 'All',
};

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  [SubmissionStatus.New]: 'New',
  [SubmissionStatus.Read]: 'Read',
  [SubmissionStatus.Archived]: 'Archived',
};

/** Delivery badges: sent / pending / failed per destination. */
export function DeliveryBadges({ delivery }: { delivery: DeliveryState }) {
  const entries = Object.entries(delivery);
  if (entries.length === 0)
    return <span className="text-xs text-muted-foreground">Inbox only</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {entries.map(([destination, record]) => (
        <Badge
          key={destination}
          variant={
            record.status === 'failed'
              ? 'destructive'
              : record.status === 'sent'
                ? 'secondary'
                : 'outline'
          }
          title={record.error}
        >
          {destination}: {record.status}
        </Badge>
      ))}
    </span>
  );
}

export interface OpenSubmission {
  readonly id: string;
  readonly createdAt: string;
  readonly status: SubmissionStatus;
  readonly locale: string;
  readonly pagePath: string | null;
  readonly fields: ReadonlyArray<{ readonly label: string; readonly value: string }>;
  readonly delivery: DeliveryState;
}

export function InboxView({
  formId,
  inbox,
  filter,
  search,
  basePath,
  open,
  canDelete,
}: {
  formId: string;
  inbox: Inbox;
  filter: InboxFilter;
  search: string;
  basePath: string;
  open: OpenSubmission | null;
  canDelete: boolean;
}) {
  const params = (extra: Record<string, string>) =>
    new URLSearchParams({ status: filter, q: search, ...extra }).toString();
  const exportHref = `/api/forms/export?${new URLSearchParams({ form: formId, status: filter, q: search }).toString()}`;
  return (
    <div className="flex flex-col gap-4">
      {open ? (
        <Card aria-label="Submission">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>
                <h2>Submission from {formatDateTime(open.createdAt)}</h2>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {STATUS_LABEL[open.status]} · {open.locale.toUpperCase()} · {open.pagePath ?? '—'}
              </p>
              <DeliveryBadges delivery={open.delivery} />
            </div>
            <SubmissionActions
              formId={formId}
              id={open.id}
              status={open.status}
              canDelete={canDelete}
              listHref={`${basePath}?${params({})}`}
            />
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-[12rem_1fr]">
              {open.fields.map((field) => (
                <div key={field.label} className="contents">
                  <dt className="text-sm font-medium text-muted-foreground">{field.label}</dt>
                  <dd className="text-sm break-words whitespace-pre-wrap">{field.value || '—'}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <form
          method="get"
          action={basePath}
          className="flex flex-wrap items-center gap-2"
          aria-label="Filter submissions"
        >
          <select
            name="status"
            defaultValue={filter}
            aria-label="Show"
            className="text-sm h-9 rounded-md border bg-transparent px-2"
          >
            {Object.entries(FILTER_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search submissions"
            aria-label="Search submissions"
            className="max-w-64"
          />
          <Button type="submit" variant="outline" size="sm">
            Apply
          </Button>
        </form>
        <Button variant="outline" size="sm" nativeButton={false} render={<a href={exportHref} />}>
          <DownloadIcon />
          Export CSV
        </Button>
      </div>

      <Table aria-label="Submissions">
        <TableHeader>
          <TableRow>
            <TableHead>Received</TableHead>
            <TableHead>From</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Delivery</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inbox.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-sm py-8 text-center text-muted-foreground">
                No submissions here.
              </TableCell>
            </TableRow>
          ) : (
            inbox.rows.map((row) => (
              <TableRow key={row.id} data-state={open?.id === row.id ? 'selected' : undefined}>
                <TableCell className="text-sm whitespace-nowrap">
                  <Link
                    href={`${basePath}?${params({ submission: row.id })}`}
                    className={
                      row.status === SubmissionStatus.New
                        ? 'font-semibold hover:underline'
                        : 'hover:underline'
                    }
                  >
                    {formatDateTime(row.createdAt)}
                  </Link>
                </TableCell>
                <TableCell className="text-sm max-w-80 truncate">{row.preview || '—'}</TableCell>
                <TableCell>
                  <Badge variant={row.status === SubmissionStatus.New ? 'default' : 'secondary'}>
                    {STATUS_LABEL[row.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DeliveryBadges delivery={row.delivery} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {inbox.pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            Page {inbox.page} of {inbox.pageCount} · {inbox.total} submissions
          </span>
          <span className="flex gap-2">
            {inbox.page > 1 ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`${basePath}?${params({ page: String(inbox.page - 1) })}`} />}
              >
                Previous
              </Button>
            ) : null}
            {inbox.page < inbox.pageCount ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`${basePath}?${params({ page: String(inbox.page + 1) })}`} />}
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
