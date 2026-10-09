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
}: PageProps<'/admin/pages/site-wide/[globalId]'>): Promise<Metadata> {
  const { globalId } = await params;
  return { title: contentRegistry.globalById(globalId)?.label ?? 'Site-wide' };
}

/** Site-wide content (header, footer, contacts…): the generated editor without SEO. */
export default async function EditGlobalPage({
  params,
  searchParams,
}: PageProps<'/admin/pages/site-wide/[globalId]'>) {
  await requirePermission(Permission.PagesView);
  const [{ globalId }, query] = await Promise.all([params, searchParams]);
  const global = contentRegistry.globalById(globalId);
  if (!global) notFound();

  const basePath = pagesAreaHref(PagesArea.SiteWide, global.id);
  const { locale, locales } = await resolveEditorLocale(query, basePath);
  const data = await loadEditorData({ kind: DocumentKind.Global, id: global.id }, locale);
  if (!data) notFound();
  return (
    <DocumentEditor
      key={`${global.id}:${locale}`}
      data={data}
      locales={locales}
      basePath={basePath}
      subtitle="Shown on every page"
    />
  );
}
