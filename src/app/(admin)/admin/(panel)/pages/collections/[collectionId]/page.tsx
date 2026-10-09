import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ItemTable } from '@/admin/components/collections/item-table';
import { NewItemButton } from '@/admin/components/collections/new-item-button';
import { PageHeader } from '@/admin/components/layout/page-header';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import {
  ItemSort,
  type ItemTableQuery,
  loadItemTable,
  STATUS_FILTER_ALL,
} from '@/core/collections/admin';
import { CollectionItemStatus } from '@/core/content/collection';
import { untitledItemLabel } from '@/core/content/document';
import { contentRegistry } from '@/core/content/project-registry';
import { getDb } from '@/core/db/client';
import { PagesArea, pagesAreaHref } from '@/core/project/paths';
import { readSiteSettings } from '@/core/settings/repository';

export const instant = false;

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.find((option) => option === value) ?? fallback;
}

export async function generateMetadata({
  params,
}: PageProps<'/admin/pages/collections/[collectionId]'>): Promise<Metadata> {
  const { collectionId } = await params;
  return { title: contentRegistry.collectionById(collectionId)?.label ?? 'Collection' };
}

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<'/admin/pages/collections/[collectionId]'>) {
  await requirePermission(Permission.PagesView);
  const [{ collectionId }, raw] = await Promise.all([params, searchParams]);
  const collection = contentRegistry.collectionById(collectionId);
  if (!collection) notFound();

  const query: ItemTableQuery = {
    search: typeof raw.q === 'string' ? raw.q.slice(0, 100) : '',
    status: oneOf(
      raw.status,
      [STATUS_FILTER_ALL, CollectionItemStatus.Draft, CollectionItemStatus.Published],
      STATUS_FILTER_ALL,
    ),
    sort: oneOf(raw.sort, Object.values(ItemSort), ItemSort.Updated),
    page: Math.max(1, Number.parseInt(typeof raw.page === 'string' ? raw.page : '1', 10) || 1),
  };
  const db = await getDb();
  const { general } = await readSiteSettings(db);
  const table = await loadItemTable(
    db,
    collection,
    query,
    general.enabledLocales,
    general.defaultLocale,
  );
  const basePath = pagesAreaHref(PagesArea.Collections, collection.id);

  return (
    <>
      <PageHeader
        title={collection.label}
        description={`${table.total} ${table.total === 1 ? 'item' : 'items'}`}
        actions={
          <NewItemButton
            collectionId={collection.id}
            itemLabel={collection.itemLabel}
            basePath={basePath}
          />
        }
      />
      <ItemTable
        table={table}
        query={query}
        basePath={basePath}
        locales={general.enabledLocales}
        itemLabel={collection.itemLabel}
        untitled={untitledItemLabel(collection.itemLabel)}
      />
    </>
  );
}
