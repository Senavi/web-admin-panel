import {
  CardSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/admin/components/layout/skeletons';

export default function SecurityLoading() {
  return (
    <LoadingRegion label="Loading security">
      <PageHeaderSkeleton />
      <CardSkeleton lines={1} />
      <TableSkeleton rows={3} columns={3} />
      <CardSkeleton lines={6} />
    </LoadingRegion>
  );
}
