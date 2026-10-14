import {
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
  TabsSkeleton,
} from '@/admin/components/layout/skeletons';
import { Skeleton } from '@/admin/ui/skeleton';

/** Form requests inbox. */
export default function FormLoading() {
  return (
    <LoadingRegion label="Loading requests">
      <PageHeaderSkeleton />
      <TabsSkeleton tabs={2} />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-40" />
      </div>
      <TableSkeleton rows={6} columns={4} />
    </LoadingRegion>
  );
}
