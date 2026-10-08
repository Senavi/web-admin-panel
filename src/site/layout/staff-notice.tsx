'use client';

import { useSyncExternalStore } from 'react';

import { SITE_NOTICE_COOKIE, SiteNotice } from '@/core/site-gate/notice';

const MESSAGES: Record<SiteNotice, string> = {
  [SiteNotice.Maintenance]: 'Maintenance mode is on. Visitors see the maintenance page.',
  [SiteNotice.Private]: 'Private mode is on. Only signed-in users can see the site.',
};

function readNotice(): SiteNotice | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${SITE_NOTICE_COOKIE}=([^;]+)`));
  const value = match?.[1];
  return value === SiteNotice.Maintenance || value === SiteNotice.Private ? value : null;
}

/**
 * Small banner for signed-in staff while maintenance or private mode is on.
 * Pages are static, so the proxy sets a non-sensitive notice cookie that this
 * component reads (renders nothing for regular visitors).
 */
export function StaffNotice() {
  const notice = useSyncExternalStore(
    () => () => undefined,
    readNotice,
    () => null,
  );
  if (!notice) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-overlay bg-inverse px-gutter py-2 text-center text-body-sm text-inverse-foreground"
    >
      {MESSAGES[notice]}
    </div>
  );
}
