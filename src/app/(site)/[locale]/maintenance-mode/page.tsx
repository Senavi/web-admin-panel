// content-check: ignore (served by the proxy with HTTP 503 while maintenance mode is on)
import type { Metadata } from 'next';

import { getSiteSettings } from '@/core/settings/loader';
import { MaintenanceView } from '@/site/maintenance';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MaintenancePage({ params }: PageProps<'/[locale]/maintenance-mode'>) {
  const { locale } = await params;
  const settings = await getSiteSettings();
  return (
    <MaintenanceView
      locale={locale}
      siteName={settings.general.siteName}
      message={settings.status.maintenance.message}
    />
  );
}
