'use client';

import { useRouter } from 'next/navigation';

import { useAction } from '@/admin/hooks/use-action';
import { formatDateTime } from '@/admin/lib/format';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { revokeOtherSessionsAction, revokeOwnSessionAction } from '@/core/auth/actions';

export interface SessionRow {
  readonly id: string;
  readonly userAgent: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly current: boolean;
}

export function SessionsList({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const revoke = useAction(revokeOwnSessionAction, { onSuccess: () => router.refresh() });
  const revokeOthers = useAction(revokeOtherSessionsAction, { onSuccess: () => router.refresh() });
  const others = sessions.filter((session) => !session.current).length;

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y rounded-md border">
        {sessions.map((session) => (
          <li key={session.id} className="text-sm flex items-center justify-between gap-4 p-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{describeAgent(session.userAgent)}</p>
              <p className="text-muted-foreground">
                Signed in {formatDateTime(session.createdAt)} · expires{' '}
                {formatDateTime(session.expiresAt)}
              </p>
            </div>
            {session.current ? (
              <Badge variant="secondary">This device</Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={revoke.pending}
                onClick={() => void revoke.run({ sessionId: session.id })}
              >
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
      {others > 0 ? (
        <div>
          <Button
            variant="outline"
            disabled={revokeOthers.pending}
            onClick={() => void revokeOthers.run(undefined)}
          >
            Sign out all other sessions
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Rough, dependency-free user agent summary for display only. */
export function describeAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /iPhone|iPad/.test(userAgent)
      ? 'iOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Unknown OS';
  return `${browser} on ${os}`;
}
