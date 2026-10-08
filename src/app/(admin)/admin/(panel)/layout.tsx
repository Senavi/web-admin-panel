import { Suspense } from 'react';

import { requireUser } from '@/core/auth/server/session';

/** Authenticated admin area. The full shell (sidebar, header) is added in the admin shell phase. */
/** The admin is per-request (auth-gated); opt out of instant-navigation validation. */
export const instant = false;

export default function AdminPanelLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <Suspense>
      <Authenticated>{children}</Authenticated>
    </Suspense>
  );
}

async function Authenticated({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">{children}</div>;
}
