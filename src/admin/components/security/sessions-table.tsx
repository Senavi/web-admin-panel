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
        <Table aria-label="Signed-in devices">
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Signed in</TableHead>
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
                      Sign out
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
              title: 'Sign out everyone else?',
              description: 'Every other device is signed out right away. You stay signed in.',
              confirmLabel: 'Sign out everyone else',
              destructive: true,
            }).then((yes) => {
              if (yes) void revokeAll.run(undefined);
            })
          }
        >
          Sign out everyone else
        </Button>
      </div>
    </div>
  );
}
