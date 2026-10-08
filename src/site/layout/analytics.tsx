import Script from 'next/script';

/** Loads the cookieless analytics beacon after the page is idle (never on admin pages). */
export function Analytics() {
  return <Script src="/a.js" strategy="lazyOnload" />;
}
