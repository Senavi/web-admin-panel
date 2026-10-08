import { cookies } from 'next/headers';

import { AdminHeader } from '@/admin/components/layout/admin-header';
import { AppSidebar } from '@/admin/components/layout/app-sidebar';
import { GateRefresher } from '@/admin/components/layout/gate-refresher';
import { LocalDbBanner } from '@/admin/components/layout/local-db-banner';
import { SIDEBAR_COOKIE_NAME, SidebarInset, SidebarProvider } from '@/admin/ui/sidebar';
import { registry } from '@/content';
import { requireUser } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import { readSiteSettings } from '@/core/settings/repository';

const PAGE_LABELS = Object.fromEntries(registry.pages.map((page) => [page.id, page.label]));

/** The admin is per-request (auth-gated); opt out of instant-navigation validation. */
export const instant = false;

/** Authenticated admin shell: sidebar + header around every panel screen. */
export default async function AdminPanelLayout({ children }: LayoutProps<'/admin'>) {
  // Per-page guards apply the 2FA policy (Account must stay reachable to set it up).
  const user = await requireUser({ allowMissingTwoFactor: true });
  const [cookieStore, settings] = await Promise.all([cookies(), getDb().then(readSiteSettings)]);
  const defaultOpen = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value !== 'false';

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar role={user.role} siteName={settings.general.siteName} />
      <SidebarInset>
        <LocalDbBanner />
        <AdminHeader user={user} status={settings.status} pageLabels={PAGE_LABELS} />
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6">
          {children}
        </div>
      </SidebarInset>
      <GateRefresher />
    </SidebarProvider>
  );
}
