import {
  CardSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
} from '@/admin/components/layout/skeletons';

export default function AccountLoading() {
  return (
    <LoadingRegion label="Loading account">
      <PageHeaderSkeleton />
      <div className="flex max-w-3xl flex-col gap-4">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={1} />
        <CardSkeleton lines={1} />
        <CardSkeleton lines={1} />
      </div>
    </LoadingRegion>
  );
}
