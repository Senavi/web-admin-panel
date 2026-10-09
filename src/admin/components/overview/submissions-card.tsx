import { InboxIcon } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/ui/card';

/** Overview: new form submissions per form, linking to each inbox. */
export function SubmissionsCard({
  forms,
}: {
  forms: ReadonlyArray<{ readonly label: string; readonly href: string; readonly count: number }>;
}) {
  const total = forms.reduce((sum, form) => sum + form.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <InboxIcon aria-hidden className="size-4" />
            New submissions
          </h2>
        </CardTitle>
        <CardDescription>
          {total === 0 ? 'Nothing new.' : `${total} new submission${total === 1 ? '' : 's'}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1">
          {forms.map((form) => (
            <li key={form.href} className="text-sm flex items-center justify-between gap-2">
              <Link href={form.href} className="hover:underline">
                {form.label}
              </Link>
              <span className="text-muted-foreground tabular-nums">{form.count}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
