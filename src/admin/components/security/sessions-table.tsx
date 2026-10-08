'use client';

import { useRouter } from 'next/navigation';

import { describeAgent } from '@/admin/lib/user-agent';
import { useConfirm } from '@/admin/hooks/use-confirm';
import { useAction } from '@/admin/hooks/use-action';
import { formatDateTime } from '@/admin/lib/format';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/ui/table';
import { revokeAllSessionsAction, revokeSessionAction } from '@/core/security/actions';

export interface GlobalSessionRow {
  readonly id: string;
  readonly email: string;
  readonly userAgent: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly current: boolean;
}

export function SessionsTable({ rows }: { rows: readonly GlobalSessionRow[] }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const revoke = useAction(revokeSessionAction, { onSuccess: () => router.refresh() });
  const revokeAll = useAction(revokeAllSessionsAction, { onSuccess: () => router.refresh() });
  return (
    <div className="flex flex-col gap-3">
      {dialog}
      <div className="overflow-x-auto rounded-md border">
        <Table aria-label="Active sessions">
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Signed in</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.email}</TableCell>
                <TableCell>{describeAgent(row.userAgent)}</TableCell>
                <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                <TableCell>{formatDateTime(row.expiresAt)}</TableCell>
                <TableCell className="text-end">
                  {row.current ? (
                    <Badge variant="secondary">This device</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revoke.pending}
                      onClick={() => void revoke.run({ sessionId: row.id })}
                    >
                      Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div>
        <Button
          variant="destructive"
          disabled={revokeAll.pending || rows.length <= 1}
          onClick={() =>
            void confirm({
              title: 'Sign everyone out?',
              description: 'All sessions except yours are revoked immediately.',
              confirmLabel: 'Revoke all',
              destructive: true,
            }).then((yes) => {
              if (yes) void revokeAll.run(undefined);
            })
          }
        >
          Revoke all other sessions
        </Button>
      </div>
    </div>
  );
}
