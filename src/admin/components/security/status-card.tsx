import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';

import { Card, CardContent } from '@/admin/ui/card';

/** "Everything works" or the problems in plain language. */
export function StatusCard({ problems, okText }: { problems: readonly string[]; okText: string }) {
  const ok = problems.length === 0;
  const Icon = ok ? CircleCheckIcon : CircleAlertIcon;
  return (
    <Card aria-label="Status" role="region">
      <CardContent className="flex items-start gap-3">
        <Icon
          aria-hidden
          className={
            ok
              ? 'text-emerald-600 dark:text-emerald-400 mt-0.5 size-5 shrink-0'
              : 'text-destructive mt-0.5 size-5 shrink-0'
          }
        />
        <div className="flex flex-col gap-1">
          <h2 className="font-medium">{ok ? 'Everything works' : 'Something needs attention'}</h2>
          {ok ? (
            <p className="text-sm text-muted-foreground">{okText}</p>
          ) : (
            <ul className="text-sm flex flex-col gap-1 text-muted-foreground">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
