import { ExternalLinkIcon } from 'lucide-react';

import { Button } from '@/admin/ui/button';
import { Separator } from '@/admin/ui/separator';
import { SidebarTrigger } from '@/admin/ui/sidebar';
import type { CurrentUser } from '@/core/auth/server/session';
import type { SiteSettings } from '@/core/settings/schema';

import { Breadcrumbs, type SegmentLabels } from './breadcrumbs';
import { StatusChips } from './status-chips';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export function AdminHeader({
  user,
  status,
  labels,
  childLabels,
}: {
  user: CurrentUser;
  status: SiteSettings['status'];
  labels: SegmentLabels;
  childLabels: Record<string, string>;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4 self-center" />
      <div className="min-w-0 flex-1">
        <Breadcrumbs labels={labels} childLabels={childLabels} />
      </div>
      <StatusChips status={status} />
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<a href="/" target="_blank" rel="noopener noreferrer" />}
      >
        <ExternalLinkIcon />
        <span className="hidden sm:inline">View site</span>
      </Button>
      <ThemeToggle />
      <UserMenu name={user.name} email={user.email} role={user.role} />
    </header>
  );
}
