'use client';

import { CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/ui/table';
import type { EnvStatus } from '@/core/security/env-catalog';

const REQUIREMENT_LABEL = {
  production: 'Required in production',
  optional: 'Optional',
  development: 'Development only',
} as const;

/** Environment variables with set/missing status and masked values (never full secrets). */
export function EnvTable({
  rows,
  production,
}: {
  rows: readonly EnvStatus[];
  production: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table aria-label="Environment variables">
        <TableHeader>
          <TableRow>
            <TableHead>Variable</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Purpose</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const missingRequired = production && row.requirement === 'production' && !row.set;
            return (
              <TableRow key={row.name}>
                <TableCell>
                  <span className="text-xs flex items-center gap-1 font-mono">
                    {row.name}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Copy ${row.name}`}
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(row.name)
                          .then(() => toast.success('Copied.'))
                      }
                    >
                      <CopyIcon />
                    </Button>
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Badge
                      variant={missingRequired ? 'destructive' : row.set ? 'secondary' : 'outline'}
                    >
                      {row.set ? 'Set' : 'Missing'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {REQUIREMENT_LABEL[row.requirement]}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-xs max-w-64 truncate font-mono">
                  {row.masked ?? '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.description}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
