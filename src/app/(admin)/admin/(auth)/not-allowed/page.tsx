import type { Metadata } from 'next';

import AdminNotFound from '../../not-found';

export const metadata: Metadata = { title: 'Page not found' };

/** Target of the proxy's early 404 for admin screens the user's role may not open. */
export default function NotAllowedPage() {
  return <AdminNotFound />;
}
