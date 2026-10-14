import {
  CardSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
} from '@/admin/components/layout/skeletons';
import { Card, CardContent, CardHeader } from '@/admin/ui/card';
import { Skeleton } from '@/admin/ui/skeleton';

/** Overview (route group: this loading state wraps only the Overview page). */
export default function OverviewLoading() {
  return (
    <LoadingRegion label="Loading overview">
      <PageHeaderSkeleton actions />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Card key={index}>
            <CardHeader className="flex flex-col gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent>
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={5} />
      </div>
    </LoadingRegion>
  );
}
