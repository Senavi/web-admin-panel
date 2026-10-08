// content-check: ignore (static localized 404; the proxy rewrites unknown URLs here with HTTP 404)
import type { Metadata } from 'next';

import { NotFoundView } from '@/site/pages/not-found';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PageNotFound() {
  return <NotFoundView />;
}
