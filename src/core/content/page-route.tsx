import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ComponentType } from 'react';

import { registry } from '@/content';
import { isEnabledLocale } from '@/core/i18n/locales';

import { getPageContent, type PageId, type SitePageContent } from './loader';

export interface PageViewProps<Id extends PageId> {
  readonly content: SitePageContent<Id>;
  readonly locale: string;
}

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
}

/**
 * Wires a registered page to a route file under `src/app/(site)/[locale]/…`:
 *
 *   const route = createPageRoute('about', AboutView);
 *   export default route.Page;
 *   export const generateMetadata = route.generateMetadata;
 *
 * `pnpm content:check` uses the `createPageRoute('<id>'` call to verify that
 * routes and the registry match.
 */
export function createPageRoute<Id extends PageId>(
  pageId: Id,
  View: ComponentType<PageViewProps<Id>>,
) {
  const page = registry.byId(pageId);
  if (!page) throw new Error(`createPageRoute: unknown page "${pageId}".`);

  async function Page({ params }: RouteProps) {
    const { locale } = await params;
    if (!(await isEnabledLocale(locale))) notFound();
    const content = await getPageContent(pageId, locale);
    return <View content={content} locale={locale} />;
  }

  async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
    const { locale } = await params;
    const { buildPageMetadata } = await import('@/core/seo/page-metadata');
    return buildPageMetadata(pageId, locale);
  }

  return { pageId, Page, generateMetadata };
}
