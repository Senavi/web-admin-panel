import { cookies } from 'next/headers';
import { Suspense } from 'react';

import { AdminHeader } from '@/admin/components/layout/admin-header';
import { AppSidebar } from '@/admin/components/layout/app-sidebar';
import { DeveloperModeProvider } from '@/admin/components/layout/developer-mode';
import { GateRefresher } from '@/admin/components/layout/gate-refresher';
import { EnvironmentBar } from '@/admin/components/layout/environment-bar';
import { LocalDbBanner } from '@/admin/components/layout/local-db-banner';
import { NavigationProgress } from '@/admin/components/layout/navigation-progress';
import { SIDEBAR_COOKIE_NAME, SidebarInset, SidebarProvider } from '@/admin/ui/sidebar';
import { contentRegistry } from '@/core/content/project-registry';
import { isStaging } from '@/core/deployment/current';
import { adminHref, AdminRoute, PagesArea } from '@/core/project/paths';
import { can, Permission } from '@/core/auth/permissions';
import { requireUser } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import { countNew } from '@/core/forms/inbox';
import { getRequestSettings } from '@/core/settings/request';
import { timed } from '@/core/perf/timing';

const byId = <T extends { id: string }>(items: readonly T[], label: (item: T) => string) =>
  Object.fromEntries(items.map((item) => [item.id, label(item)]));

/** Breadcrumb labels for page ids, collection ids and their items. */
const BREADCRUMB_LABELS = {
  [AdminRoute.Pages.slice(1)]: byId(contentRegistry.pages, (page) => page.label),
  [PagesArea.Collections]: byId(contentRegistry.collections, (collection) => collection.label),
  [PagesArea.SiteWide]: byId(contentRegistry.globals, (global) => global.label),
  [PagesArea.Forms]: byId(contentRegistry.forms, (form) => form.label),
  [PagesArea.Shared]: byId(contentRegistry.sharedSections, (shared) => shared.label),
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
  const db = await getDb();
  const canReadForms = can(user.role, Permission.FormsView) && contentRegistry.forms.length > 0;
  const [cookieStore, settings, unread] = await Promise.all([
    cookies(),
    getRequestSettings(),
    canReadForms
      ? timed('db:unread', () =>
          countNew(
            db,
            contentRegistry.forms.map((form) => form.id),
          ),
        )
      : Promise.resolve({} as Record<string, number>),
  ]);
  const defaultOpen = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value !== 'false';
  const newRequests = Object.values(unread).reduce((sum, value) => sum + value, 0);
  const badges = newRequests > 0 ? { [adminHref(AdminRoute.Pages)]: `${newRequests} new` } : {};

  return (
    <DeveloperModeProvider enabled={user.developerMode}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar role={user.role} siteName={settings.general.siteName} badges={badges} />
        <SidebarInset>
          <EnvironmentBar />
          <LocalDbBanner developerMode={user.developerMode} />
          <AdminHeader
            user={user}
            status={settings.status}
            staging={isStaging()}
            labels={BREADCRUMB_LABELS}
            childLabels={BREADCRUMB_CHILD_LABELS}
          />
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6">
            {children}
          </div>
        </SidebarInset>
        <GateRefresher />
        {/* useSearchParams needs a Suspense boundary. */}
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
      </SidebarProvider>
    </DeveloperModeProvider>
  );
}
