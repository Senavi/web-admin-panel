import {
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/admin/components/layout/skeletons';
import { Skeleton } from '@/admin/ui/skeleton';

export default function ActivityLoading() {
  return (
    <LoadingRegion label="Loading activity">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-20" />
      </div>
      <TableSkeleton rows={8} columns={4} />
    </LoadingRegion>
  );
}
