import { DatabaseIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/admin/ui/button';
import { getDbInfo } from '@/core/db/client';
import { DbMode } from '@/core/db/types';
import { adminHref, AdminRoute } from '@/core/project/paths';

/** Shown on every admin screen (including login) while the embedded PGlite database is used. */
export function LocalDbBanner() {
  if (getDbInfo().mode !== DbMode.Local) return null;
  return (
    <div
      role="status"
      data-testid="local-db-banner"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200"
    >
      <span className="flex items-center gap-2">
        <DatabaseIcon className="size-4 shrink-0" aria-hidden />
        Using local database. Data is stored on this machine only.
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        nativeButton={false}
        render={<Link href={`${adminHref(AdminRoute.Security)}#database`} />}
      >
        Connect Supabase
      </Button>
    </div>
  );
}
