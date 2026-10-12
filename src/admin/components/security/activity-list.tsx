import Link from 'next/link';

import { formatDateTime } from '@/admin/lib/format';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/admin/ui/card';

export interface ActivityItem {
  readonly id: string;
  readonly text: string;
  readonly ts: string;
}

/** Recent activity as sentences, with a link to the full log. */
export function ActivityList({
  items,
  fullLogHref,
}: {
  items: readonly ActivityItem[];
  fullLogHref: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Recent activity</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>
        ) : (
          <ul className="flex flex-col divide-y" aria-label="Recent activity">
            {items.map((item) => (
              <li
                key={item.id}
                className="text-sm flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
              >
                <span>{item.text}</span>
                <span className="text-xs whitespace-nowrap text-muted-foreground">
                  {formatDateTime(item.ts)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter>
        <Link href={fullLogHref} className="text-sm font-medium underline-offset-4 hover:underline">
          Show all activity
        </Link>
      </CardFooter>
    </Card>
  );
}
