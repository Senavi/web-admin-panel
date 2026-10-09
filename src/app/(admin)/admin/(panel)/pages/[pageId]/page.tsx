import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DocumentEditor } from '@/admin/components/content/document-editor';
import { resolveEditorLocale } from '@/admin/server/editor-locale';
import { registry } from '@/content';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import { DocumentKind } from '@/core/content/document-target';
import { loadEditorData } from '@/core/content/editor';
import { adminHref, AdminRoute } from '@/core/project/paths';

export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<'/admin/pages/[pageId]'>): Promise<Metadata> {
  const { pageId } = await params;
  return { title: registry.byId(pageId)?.label ?? 'Page' };
}

export default async function EditPagePage({
  params,
  searchParams,
}: PageProps<'/admin/pages/[pageId]'>) {
  await requirePermission(Permission.PagesView);
  const [{ pageId }, query] = await Promise.all([params, searchParams]);
  if (!registry.byId(pageId)) notFound();

  const basePath = `${adminHref(AdminRoute.Pages)}/${pageId}`;
  const { locale, locales } = await resolveEditorLocale(query, basePath);
  const data = await loadEditorData({ kind: DocumentKind.Page, id: pageId }, locale);
  if (!data) notFound();
  return (
    <DocumentEditor key={`${pageId}:${locale}`} data={data} locales={locales} basePath={basePath} />
  );
}
