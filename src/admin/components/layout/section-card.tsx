import type { ReactNode } from 'react';

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/admin/ui/card';

/** Titled card for a group of related controls (Account, Settings, Security). */
export function SectionCard({
  id,
  title,
  description,
  action,
  children,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
