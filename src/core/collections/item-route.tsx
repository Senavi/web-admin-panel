import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ComponentType } from 'react';

import { can, Permission } from '@/core/auth/permissions';
import { getCurrentUser } from '@/core/auth/server/session';
import { collectionItemPath } from '@/core/content/collection';
import type { ResolvedImage } from '@/core/content/define';
import { contentRegistry } from '@/core/content/project-registry';
import { getLocaleSettings, isEnabledLocale } from '@/core/i18n/locales';
import { localizedPath } from '@/core/i18n/routing';
import { JsonLd } from '@/core/seo/json-ld';
import { composeMetadata, defaultOgImagePath } from '@/core/seo/page-metadata';
import { absoluteUrl } from '@/core/seo/site-url';
import { buildItemStructuredData } from '@/core/seo/structured-data';

import {
  type CollectionId,
  findSlugRedirect,
  getCollectionItem,
  getCollectionItemPreview,
  getItemSeo,
  getPublishedSlugs,
  type SiteCollectionItem,
} from './loader';

export interface CollectionItemViewProps<Id extends CollectionId> {
  readonly item: SiteCollectionItem<Id>;
  readonly locale: string;
  /** True while a staff member previews (possibly unpublished) content in Draft Mode. */
  readonly preview: boolean;
}

interface RouteProps {
  readonly params: Promise<{ locale: string; slug: string }>;
}

/** Placeholder param when a collection has no published items yet (Cache Components needs one). */
const NO_ITEMS_SLUG = '__none__';

function isImage(value: unknown): value is ResolvedImage {
  return typeof value === 'object' && value !== null && 'src' in value && 'id' in value;
}

/**
 * Wires a collection to its item route under `src/app/(site)/[locale]/…/[slug]`:
 *
 *   const route = createCollectionItemRoute('blog', PostView);
 *   export default route.Page;
 *   export const generateMetadata = route.generateMetadata;
 *   export const generateStaticParams = route.generateStaticParams;
 *
 * Unknown or unpublished slugs render the localized 404, old slugs redirect
 * (308) to the current URL, and staff can preview drafts in Draft Mode
 * (enabled from the admin's Preview button). `pnpm content:check` uses the
 * `createCollectionItemRoute('<id>'` call to verify the route path.
 */
export function createCollectionItemRoute<Id extends CollectionId>(
  collectionId: Id,
  View: ComponentType<CollectionItemViewProps<Id>>,
) {
  const found = contentRegistry.collectionById(collectionId);
  if (!found) throw new Error(`createCollectionItemRoute: unknown collection "${collectionId}".`);
  const collection = found;

  async function generateStaticParams({ params }: { params: { locale: string } }) {
    const slugs = await getPublishedSlugs(collectionId, params.locale);
    return (slugs.length > 0 ? slugs : [NO_ITEMS_SLUG]).map((slug) => ({ slug }));
  }

  /** Draft Mode only counts for signed-in staff who can view content. */
  async function isPreview(): Promise<boolean> {
    if (!(await draftMode()).isEnabled) return false;
    const user = await getCurrentUser();
    return user !== null && can(user.role, Permission.PagesView);
  }

  async function load(locale: string, slug: string) {
    const preview = await isPreview();
    // A preview renders per request; skip the prerender phases (caches are bypassed anyway).
    if (preview) await connection();
    const item = preview
      ? await getCollectionItemPreview(collectionId, slug, locale)
      : await getCollectionItem(collectionId, slug, locale);
    return { item: item as SiteCollectionItem<Id> | null, preview };
  }

  async function Page({ params }: RouteProps) {
    const { locale, slug } = await params;
    if (!(await isEnabledLocale(locale))) notFound();
    const { item, preview } = await load(locale, slug);
    if (!item) {
      const current = await findSlugRedirect(collectionId, slug);
      if (current) {
        const { defaultLocale } = await getLocaleSettings();
        permanentRedirect(
          localizedPath(collectionItemPath(collection, current), locale, defaultLocale),
        );
      }
      notFound();
    }
    const content = item.content as Readonly<Record<string, unknown>>;
    const image = collection.imageField ? content[collection.imageField] : null;
    const summary = collection.summaryField ? content[collection.summaryField] : '';
    const structuredData = await buildItemStructuredData({
      collection: collection,
      locale,
      path: collectionItemPath(collection, item.slug),
      title: item.title,
      description: typeof summary === 'string' ? summary : '',
      imageUrl: isImage(image) ? absoluteUrl(image.src) : null,
      publishedAt: item.publishedAt,
      updatedAt: item.updatedAt,
      content,
    });
    return (
      <>
        <JsonLd data={structuredData} />
        <View item={item} locale={locale} preview={preview} />
      </>
    );
  }

  async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
    const { locale, slug } = await params;
    const { item } = await load(locale, slug);
    if (!item) return {};
    const { defaultLocale, enabledLocales } = await getLocaleSettings();
    const [seo, visible] = await Promise.all([
      getItemSeo(collectionId, item.slug, item.id, locale),
      // hreflang only for locales the item is shown in.
      Promise.all(
        enabledLocales.map(async (code) =>
          (await getPublishedSlugs(collectionId, code)).includes(item.slug) ? code : null,
        ),
      ),
    ]);
    const content = item.content as Readonly<Record<string, unknown>>;
    const image = collection.imageField ? content[collection.imageField] : null;
    const summary = collection.summaryField ? content[collection.summaryField] : '';
    const locales = visible.filter((code): code is string => code !== null);
    return composeMetadata({
      locale,
      path: collectionItemPath(collection, item.slug),
      locales: locales.length > 0 ? locales : enabledLocales,
      defaultLocale,
      seo,
      defaults: { title: item.title, description: typeof summary === 'string' ? summary : '' },
      fallbackImageId: isImage(image) ? image.id : null,
      generatedImagePath: defaultOgImagePath(collection.listPageId, locale),
      openGraphType: 'article',
      publishedTime: item.publishedAt,
      modifiedTime: item.updatedAt,
    });
  }

  return { collectionId, Page, generateMetadata, generateStaticParams };
}
