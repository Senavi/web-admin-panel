import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ComponentType } from 'react';

import { getPageContent, type PageId, type SitePageContent } from '@/core/content/loader';
import { contentRegistry } from '@/core/content/project-registry';
import { getLocaleSettings, isEnabledLocale } from '@/core/i18n/locales';
import { localizedPath } from '@/core/i18n/routing';
import { JsonLd } from '@/core/seo/json-ld';
import { buildPageMetadata } from '@/core/seo/page-metadata';
import { absoluteUrl } from '@/core/seo/site-url';
import { buildStructuredData } from '@/core/seo/structured-data';

import {
  type CollectionId,
  type CollectionPage,
  getCollectionList,
  type SiteCollectionItem,
} from './loader';
import { listPageHref, PAGE_PARAM, parseListPage } from './pagination';

export interface CollectionListViewProps<P extends PageId, C extends CollectionId> {
  /** Content of the list page itself (intro, headings…). */
  readonly content: SitePageContent<P>;
  readonly list: CollectionPage<SiteCollectionItem<C>>;
  readonly locale: string;
  /** Localized URL of a page of the list (page 1 has no `?page`). */
  readonly pageHref: (page: number) => string;
}

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Wires a registered page that lists a collection:
 *
 *   const route = createCollectionListRoute('blog', 'blog', BlogView);
 *   export default route.Page;
 *   export const generateMetadata = route.generateMetadata;
 *   export const instant = false;
 *
 * Pagination uses real URLs (`/blog?page=2`) with a self canonical; pages
 * beyond the last one return a 404. The page renders per request (the query
 * decides the status code) from cached data.
 */
export function createCollectionListRoute<P extends PageId, C extends CollectionId>(
  pageId: P,
  collectionId: C,
  View: ComponentType<CollectionListViewProps<P, C>>,
) {
  const collection = contentRegistry.collectionById(collectionId);
  const page = contentRegistry.byId(pageId);
  if (!collection || !page) {
    throw new Error(
      `createCollectionListRoute: unknown page "${pageId}" or collection "${collectionId}".`,
    );
  }
  const listPath = page.path;

  async function resolve({ params, searchParams }: RouteProps) {
    const [{ locale }, query] = await Promise.all([params, searchParams]);
    if (!(await isEnabledLocale(locale))) notFound();
    const pageNumber = parseListPage(query[PAGE_PARAM]);
    if (pageNumber === null) notFound();
    return { locale, pageNumber };
  }

  async function Page(props: RouteProps) {
    const { locale, pageNumber } = await resolve(props);
    const [content, list, structuredData, { defaultLocale }] = await Promise.all([
      getPageContent(pageId, locale),
      getCollectionList(collectionId, locale, { page: pageNumber }),
      buildStructuredData(pageId, locale),
      getLocaleSettings(),
    ]);
    if (pageNumber > list.pageCount) notFound();
    const basePath = localizedPath(listPath, locale, defaultLocale);
    return (
      <>
        <JsonLd data={structuredData} />
        <View
          content={content}
          list={list}
          locale={locale}
          pageHref={(n) => listPageHref(basePath, n)}
        />
      </>
    );
  }

  async function generateMetadata(props: RouteProps): Promise<Metadata> {
    const { locale, pageNumber } = await resolve(props);
    const metadata = await buildPageMetadata(pageId, locale);
    if (pageNumber === 1) return metadata;
    const { defaultLocale } = await getLocaleSettings();
    // Each page of the list is its own canonical URL.
    return {
      ...metadata,
      alternates: {
        ...metadata.alternates,
        canonical: absoluteUrl(
          listPageHref(localizedPath(listPath, locale, defaultLocale), pageNumber),
        ),
      },
    };
  }

  return { pageId, collectionId, Page, generateMetadata };
}
