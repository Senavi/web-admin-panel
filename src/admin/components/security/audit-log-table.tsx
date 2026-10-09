import Link from 'next/link';

import { formatDateTime } from '@/admin/lib/format';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { Input } from '@/admin/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/ui/table';
import { auditActionLabel } from '@/core/security/audit-labels';

export const AUDIT_GROUPS = {
  all: { label: 'All events', prefixes: [] },
  auth: { label: 'Sign-ins & sessions', prefixes: ['auth.'] },
  users: { label: 'Users', prefixes: ['user.'] },
  content: { label: 'Content & media', prefixes: ['content.', 'seo.', 'media.', 'collection.'] },
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

/** Server-rendered, URL-driven audit log (GET filters contain no secrets). */
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
    `${basePath}?${new URLSearchParams({ group, q: query, page: String(nextPage) }).toString()}#audit-log`;
  return (
    <div className="flex flex-col gap-3">
      <form
        method="get"
        action={`${basePath}#audit-log`}
        className="flex flex-wrap items-center gap-2"
        aria-label="Filter audit log"
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
          placeholder="Actor email or target"
          aria-label="Search audit log"
          className="max-w-64"
        />
        <Button type="submit" variant="outline" size="sm">
          Filter
        </Button>
      </form>
      <div className="overflow-x-auto rounded-md border">
        <Table aria-label="Audit log">
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Target</TableHead>
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
                          {row.action}
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>{row.actorEmail ?? '—'}</TableCell>
                  <TableCell
                    className="text-xs max-w-72 truncate font-mono"
                    title={row.summary ?? undefined}
                  >
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
