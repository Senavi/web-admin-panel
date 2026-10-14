import {
  CardSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/admin/components/layout/skeletons';

export default function ManagersLoading() {
  return (
    <LoadingRegion label="Loading managers">
      <PageHeaderSkeleton actions />
      <div className="grid gap-4 sm:grid-cols-2">
        <CardSkeleton lines={1} />
        <CardSkeleton lines={1} />
      </div>
      <TableSkeleton rows={4} columns={4} />
    </LoadingRegion>
  );
}
