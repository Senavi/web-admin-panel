import Link from 'next/link';

import { Button } from '@/admin/ui/button';
import { adminHref, AdminRoute } from '@/core/project/paths';

/** Unknown admin URLs and screens the current role may not open. */
export default function AdminNotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-muted-foreground text-sm font-medium">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        This page doesn’t exist or you don’t have access to it.
      </p>
      <Button nativeButton={false} render={<Link href={adminHref(AdminRoute.Overview)} />}>
        Back to Overview
      </Button>
    </main>
  );
}
