import {
  FieldsSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  TabsSkeleton,
} from '@/admin/components/layout/skeletons';

export default function SettingsLoading() {
  return (
    <LoadingRegion label="Loading settings">
      <PageHeaderSkeleton />
      <TabsSkeleton tabs={5} />
      <FieldsSkeleton fields={4} />
    </LoadingRegion>
  );
}
