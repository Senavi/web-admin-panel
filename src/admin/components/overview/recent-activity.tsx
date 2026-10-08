import { formatDateTime } from '@/admin/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/admin/ui/card';
import { auditActionLabel } from '@/core/security/audit-labels';

export interface ActivityRow {
  readonly id: string;
  readonly ts: string;
  readonly action: string;
  readonly actorEmail: string | null;
  readonly target: string | null;
}

export function RecentActivity({ rows }: { rows: readonly ActivityRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Recent activity</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.id} className="text-sm">
                <p className="font-medium">{auditActionLabel(row.action)}</p>
                <p className="text-muted-foreground">
                  {row.actorEmail ?? 'System'}
                  {row.target ? ` · ${row.target}` : ''} · {formatDateTime(row.ts)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
