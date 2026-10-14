import {
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/admin/components/layout/skeletons';
import { Skeleton } from '@/admin/ui/skeleton';

/** Collection items table. */
export default function CollectionLoading() {
  return (
    <LoadingRegion label="Loading items">
      <PageHeaderSkeleton actions />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-36" />
      </div>
      <TableSkeleton rows={6} columns={5} />
    </LoadingRegion>
  );
}
