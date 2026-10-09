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
import { adminHref, AdminRoute, PagesArea } from '@/core/project/paths';

/** Labels of dynamic segments, keyed by the segment before them (`pages` → page ids…). */
export type SegmentLabels = Readonly<Record<string, Readonly<Record<string, string>>>>;

const AREA_SEGMENTS: ReadonlySet<string> = new Set(Object.values(PagesArea));

/**
 * Breadcrumbs derived from the URL. Dynamic segments (page ids, collection ids)
 * are labeled from `labels[previousSegment][segment]`; a segment after a
 * labeled one (an item id) uses `childLabels[previousSegment]` ("Post").
 * Area segments (`collections`, `site-wide`, `forms`) have no page of their own
 * and are skipped.
 */
export function Breadcrumbs({
  labels = {},
  childLabels = {},
}: {
  labels?: SegmentLabels;
  childLabels?: Readonly<Record<string, string>>;
}) {
  const pathname = usePathname();
  const base = adminHref(AdminRoute.Overview);
  const segments = pathname.slice(base.length).split('/').filter(Boolean);

  const crumbs = [
    { href: base, label: 'Overview' },
    ...segments.flatMap((segment, index) => {
      const previous = segments[index - 1] ?? '';
      if (AREA_SEGMENTS.has(segment) && previous === AdminRoute.Pages.slice(1)) return [];
      const label =
        labels[previous]?.[segment] ??
        (AREA_SEGMENTS.has(segments[index - 2] ?? '') ? childLabels[previous] : undefined) ??
        SEGMENT_LABELS[segment] ??
        decodeURIComponent(segment);
      return [{ href: `${base}/${segments.slice(0, index + 1).join('/')}`, label }];
    }),
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
