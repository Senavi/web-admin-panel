import { Card, CardContent, CardHeader } from '@/admin/ui/card';
import { Skeleton } from '@/admin/ui/skeleton';

/**
 * Loading placeholders for admin routes (`loading.tsx`): shown the moment a
 * link is clicked, shaped like the page that is coming. Built from shadcn
 * `Skeleton`; announced once to screen readers.
 */

const LINE_WIDTHS = ['w-11/12', 'w-3/4', 'w-2/3', 'w-1/2'];

export function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="flex flex-col gap-6">
      {children}
    </div>
  );
}

export function PageHeaderSkeleton({ actions = false }: { actions?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {actions ? <Skeleton className="h-9 w-40" /> : null}
    </div>
  );
}

export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className={`h-4 ${LINE_WIDTHS[index % LINE_WIDTHS.length]}`} />
        ))}
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col divide-y rounded-md border">
      {Array.from({ length: rows + 1 }, (_, row) => (
        <div key={row} className="flex items-center gap-4 p-3">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className={row === 0 ? 'h-3 flex-1' : 'h-4 flex-1'} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function FieldsSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

export function TabsSkeleton({ tabs = 3 }: { tabs?: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: tabs }, (_, index) => (
        <Skeleton key={index} className="h-8 w-24" />
      ))}
    </div>
  );
}

/** Document editor: toolbar, tabs and collapsed section cards. */
export function EditorSkeleton() {
  return (
    <LoadingRegion label="Loading editor">
      <div className="flex flex-wrap items-center gap-3 border-b pb-3">
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="flex max-w-3xl flex-col gap-4">
        <TabsSkeleton tabs={2} />
        <CardSkeleton lines={4} />
        <CardSkeleton lines={1} />
        <CardSkeleton lines={1} />
      </div>
    </LoadingRegion>
  );
}
