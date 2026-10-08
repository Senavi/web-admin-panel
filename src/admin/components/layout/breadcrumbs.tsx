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

/**
 * Breadcrumbs derived from the URL. Screens can label dynamic segments (e.g. a
 * page id) by passing `labels`.
 */
export function Breadcrumbs({ labels = {} }: { labels?: Record<string, string> }) {
  const pathname = usePathname();
  const base = adminHref(AdminRoute.Overview);
  const segments = pathname.slice(base.length).split('/').filter(Boolean);

  const crumbs = [
    { href: base, label: 'Overview' },
    ...segments.map((segment, index) => ({
      href: `${base}/${segments.slice(0, index + 1).join('/')}`,
      label: labels[segment] ?? SEGMENT_LABELS[segment] ?? decodeURIComponent(segment),
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
