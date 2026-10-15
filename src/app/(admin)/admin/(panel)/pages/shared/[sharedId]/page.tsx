import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DocumentEditor } from '@/admin/components/content/document-editor';
import { resolveEditorLocale } from '@/admin/server/editor-locale';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import { DocumentKind } from '@/core/content/document-target';
import { loadEditorData } from '@/core/content/editor';
import { contentRegistry } from '@/core/content/project-registry';
import { PagesArea, pagesAreaHref } from '@/core/project/paths';

export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<'/admin/pages/shared/[sharedId]'>): Promise<Metadata> {
  const { sharedId } = await params;
  return { title: contentRegistry.sharedSectionById(sharedId)?.label ?? 'Shared section' };
}

/** A shared section opened directly from "Every page" (it is also editable on each page). */
export default async function EditSharedSectionPage({
  params,
  searchParams,
}: PageProps<'/admin/pages/shared/[sharedId]'>) {
  await requirePermission(Permission.PagesView);
  const [{ sharedId }, query] = await Promise.all([params, searchParams]);
  const shared = contentRegistry.sharedSectionById(sharedId);
  if (!shared) notFound();

  const basePath = pagesAreaHref(PagesArea.Shared, shared.id);
  const { locale, locales } = await resolveEditorLocale(query, basePath);
  const data = await loadEditorData({ kind: DocumentKind.Shared, id: shared.id }, locale);
  if (!data) notFound();
  const pages = contentRegistry.pagesUsingShared(shared.id).length;
  return (
    <DocumentEditor
      key={`${shared.id}:${locale}`}
      data={data}
      locales={locales}
      basePath={basePath}
      subtitle={`Shared section · used on ${pages} ${pages === 1 ? 'page' : 'pages'}`}
    />
  );
}
