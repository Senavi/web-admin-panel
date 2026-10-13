import Script from 'next/script';

import { isPreviewMode } from '@/core/preview/mode';

/**
 * Loads the cookieless analytics beacon after the page is idle (never on admin
 * pages; off in preview mode, where there is no database to count into).
 */
export function Analytics() {
  if (isPreviewMode()) return null;
  return <Script src="/a.js" strategy="lazyOnload" />;
}
