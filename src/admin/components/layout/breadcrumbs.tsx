'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

import { SEGMENT_LABELS } from '@/admin/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/admin/ui/breadcrumb';
import { adminHref, AdminRoute } from '@/core/project/paths';

const PAGES_SEGMENT = AdminRoute.Pages.slice(1);

/**
 * Breadcrumbs derived from the URL. The segment after `pages` is a page id and
 * is shown with its registry label (`pageLabels`).
 */
export function Breadcrumbs({ pageLabels = {} }: { pageLabels?: Record<string, string> }) {
  const pathname = usePathname();
  const base = adminHref(AdminRoute.Overview);
  const segments = pathname.slice(base.length).split('/').filter(Boolean);

  const crumbs = [
    { href: base, label: 'Overview' },
    ...segments.map((segment, index) => ({
      href: `${base}/${segments.slice(0, index + 1).join('/')}`,
      label:
        (segments[index - 1] === PAGES_SEGMENT ? pageLabels[segment] : undefined) ??
        SEGMENT_LABELS[segment] ??
        decodeURIComponent(segment),
    })),
  ];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.href}>
            {index > 0 ? <BreadcrumbSeparator className="hidden sm:block" /> : null}
            <BreadcrumbItem
              className={index < crumbs.length - 1 ? 'hidden sm:inline-flex' : undefined}
            >
              {index === crumbs.length - 1 ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
