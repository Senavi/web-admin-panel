import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { PageEditor } from '@/admin/components/content/page-editor';
import { registry } from '@/content';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import { loadEditorData } from '@/core/content/editor';
import { getDb } from '@/core/db/client';
import { localeInfo } from '@/core/i18n/locales';
import { adminHref, AdminRoute } from '@/core/project/paths';
import { readSiteSettings } from '@/core/settings/repository';

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

  const { general } = await readSiteSettings(await getDb());
  const requested = typeof query.locale === 'string' ? query.locale : general.defaultLocale;
  if (!general.enabledLocales.includes(requested)) {
    redirect(`${adminHref(AdminRoute.Pages)}/${pageId}?locale=${general.defaultLocale}`);
  }

  const data = await loadEditorData(pageId, requested);
  if (!data) notFound();
  const locales = general.enabledLocales.map((code) => ({ code, label: localeInfo(code).label }));
  return <PageEditor key={`${pageId}:${requested}`} data={data} locales={locales} />;
}
