import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ItemEditor } from '@/admin/components/collections/item-editor';
import { resolveEditorLocale } from '@/admin/server/editor-locale';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import { toDateInput } from '@/core/collections/meta';
import { previewHref } from '@/core/collections/preview-paths';
import { findItem, itemText, readItemRows } from '@/core/collections/repository';
import { collectionBasePath } from '@/core/content/collection';
import { DocumentKind } from '@/core/content/document-target';
import { loadEditorData } from '@/core/content/editor';
import { contentRegistry } from '@/core/content/project-registry';
import { getDb } from '@/core/db/client';
import { PagesArea, pagesAreaHref } from '@/core/project/paths';

export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: PageProps<'/admin/pages/collections/[collectionId]/[itemId]'>): Promise<Metadata> {
  const { collectionId } = await params;
  return { title: contentRegistry.collectionById(collectionId)?.itemLabel ?? 'Item' };
}

export default async function EditItemPage({
  params,
  searchParams,
}: PageProps<'/admin/pages/collections/[collectionId]/[itemId]'>) {
  await requirePermission(Permission.PagesView);
  const [{ collectionId, itemId }, query] = await Promise.all([params, searchParams]);
  const collection = contentRegistry.collectionById(collectionId);
  if (!collection || !UUID.test(itemId)) notFound();
  const db = await getDb();
  const item = await findItem(db, collection.id, itemId);
  if (!item) notFound();

  const listHref = pagesAreaHref(PagesArea.Collections, collection.id);
  const basePath = `${listHref}/${item.id}`;
  const { locale, defaultLocale, locales } = await resolveEditorLocale(query, basePath);
  const [data, rows] = await Promise.all([
    loadEditorData(
      { kind: DocumentKind.Item, collectionId: collection.id, itemId: item.id },
      locale,
    ),
    readItemRows(db, item.id, [defaultLocale]),
  ]);
  if (!data) notFound();

  return (
    <ItemEditor
      key={`${item.id}:${locale}`}
      data={data}
      locales={locales}
      basePath={basePath}
      listHref={listHref}
      collection={{
        id: collection.id,
        itemLabel: collection.itemLabel,
        titleField: collection.titleField,
        pathPrefix: `${collectionBasePath(collection).replace(/\/$/, '')}/`,
      }}
      itemId={item.id}
      meta={{
        slug: item.slug,
        status: item.status,
        publishedAt: toDateInput(item.publishedAt),
        version: item.version,
      }}
      defaultTitle={itemText(collection, rows, collection.titleField, defaultLocale, defaultLocale)}
      isDefaultLocale={locale === defaultLocale}
      previewHref={previewHref(collection.id, item.id, locale)}
    />
  );
}
