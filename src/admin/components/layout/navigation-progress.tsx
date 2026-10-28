'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Internal link target of a click, or null (new tab, download, external, same URL…). */
function targetOf(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest('a');
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  const href = `${url.pathname}${url.search}`;
  return href === `${window.location.pathname}${window.location.search}` ? null : href;
}

/**
 * A thin bar at the top while an admin navigation is pending (until the new
 * URL is shown). Cheap: one click listener, no timers.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = `${pathname}${search ? `?${search}` : ''}`;
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const href = targetOf(event);
      if (href) setPending(href);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Pending until the URL we navigated from changes.
  const [from, setFrom] = useState(current);
  if (from !== current) {
    setFrom(current);
    setPending(null);
  }
  if (!pending) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
    >
      <div className="h-full w-1/3 animate-nav-progress bg-primary" />
    </div>
  );
}
