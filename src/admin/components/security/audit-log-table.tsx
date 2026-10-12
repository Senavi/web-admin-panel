import Link from 'next/link';

import { formatDateTime } from '@/admin/lib/format';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { Input } from '@/admin/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/ui/table';
import { auditActionLabel } from '@/core/security/audit-labels';

export const AUDIT_GROUPS = {
  all: { label: 'Everything', prefixes: [] },
  auth: { label: 'Sign-ins & devices', prefixes: ['auth.'] },
  users: { label: 'Managers', prefixes: ['user.'] },
  content: {
    label: 'Content & media',
    prefixes: ['content.', 'seo.', 'media.', 'collection.', 'form.'],
  },
  settings: { label: 'Settings & database', prefixes: ['settings.', 'database.'] },
} as const;
export type AuditGroup = keyof typeof AUDIT_GROUPS;

export interface AuditRow {
  readonly id: string;
  readonly ts: string;
  readonly action: string;
  readonly actorEmail: string | null;
  readonly target: string | null;
  readonly summary: string | null;
}

/** Server-rendered, URL-driven activity log (GET filters contain no secrets). */
export function AuditLogTable({
  rows,
  group,
  query,
  page,
  hasNext,
  basePath,
}: {
  rows: readonly AuditRow[];
  group: AuditGroup;
  query: string;
  page: number;
  hasNext: boolean;
  basePath: string;
}) {
  const href = (nextPage: number) =>
    `${basePath}?${new URLSearchParams({ group, q: query, page: String(nextPage) }).toString()}#activity`;
  return (
    <div className="flex flex-col gap-3">
      <form
        method="get"
        action={`${basePath}#activity`}
        className="flex flex-wrap items-center gap-2"
        aria-label="Filter activity"
      >
        <select
          name="group"
          defaultValue={group}
          aria-label="Event type"
          className="text-sm h-9 rounded-md border bg-transparent px-2"
        >
          {Object.entries(AUDIT_GROUPS).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>
        <Input
          name="q"
          defaultValue={query}
          placeholder="Email or name"
          aria-label="Search activity"
          className="max-w-64"
        />
        <Button type="submit" variant="outline" size="sm">
          Filter
        </Button>
      </form>
      <div className="overflow-x-auto rounded-md border">
        <Table aria-label="Activity">
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>What happened</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Where</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  No events.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(row.ts)}</TableCell>
                  <TableCell>
                    <span className="flex flex-col gap-1">
                      <span>{auditActionLabel(row.action)}</span>
                      {row.action.endsWith('.failure') || row.action.endsWith('.locked') ? (
                        <Badge variant="destructive" className="w-fit">
                          Warning
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>{row.actorEmail ?? '—'}</TableCell>
                  <TableCell className="max-w-72 truncate" title={row.summary ?? undefined}>
                    {row.target ?? '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm flex items-center justify-between">
        <span className="text-muted-foreground">Page {page}</span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={href(page - 1)} />}
            >
              Previous
            </Button>
          ) : null}
          {hasNext ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={href(page + 1)} />}
            >
              Next
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
