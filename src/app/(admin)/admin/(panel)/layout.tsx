import { cookies } from 'next/headers';

import { AdminHeader } from '@/admin/components/layout/admin-header';
import { AppSidebar } from '@/admin/components/layout/app-sidebar';
import { GateRefresher } from '@/admin/components/layout/gate-refresher';
import { LocalDbBanner } from '@/admin/components/layout/local-db-banner';
import { SIDEBAR_COOKIE_NAME, SidebarInset, SidebarProvider } from '@/admin/ui/sidebar';
import { contentRegistry } from '@/core/content/project-registry';
import { AdminRoute, PagesArea } from '@/core/project/paths';
import { requireUser } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import { readSiteSettings } from '@/core/settings/repository';

const byId = <T extends { id: string }>(items: readonly T[], label: (item: T) => string) =>
  Object.fromEntries(items.map((item) => [item.id, label(item)]));

/** Breadcrumb labels for page ids, collection ids and their items. */
const BREADCRUMB_LABELS = {
  [AdminRoute.Pages.slice(1)]: byId(contentRegistry.pages, (page) => page.label),
  [PagesArea.Collections]: byId(contentRegistry.collections, (collection) => collection.label),
  [PagesArea.SiteWide]: byId(contentRegistry.globals, (global) => global.label),
};
const BREADCRUMB_CHILD_LABELS = byId(
  contentRegistry.collections,
  (collection) => collection.itemLabel,
);

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
        <AdminHeader
          user={user}
          status={settings.status}
          labels={BREADCRUMB_LABELS}
          childLabels={BREADCRUMB_CHILD_LABELS}
        />
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6">
          {children}
        </div>
      </SidebarInset>
      <GateRefresher />
    </SidebarProvider>
  );
}
