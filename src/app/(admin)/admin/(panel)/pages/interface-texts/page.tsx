import type { Metadata } from 'next';

import { InterfaceTextsOverview } from '@/admin/components/content/interface-texts-overview';
import { resolveEditorLocale } from '@/admin/server/editor-locale';
import { Permission } from '@/core/auth/permissions';
import { requirePermission } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import { PagesArea, pagesAreaHref } from '@/core/project/paths';
import { loadUiTextGroups } from '@/core/ui-texts/editor';
import { uiTextCatalog } from '@/core/ui-texts/project-catalog';

export const instant = false;
export const metadata: Metadata = { title: 'Interface texts' };

/** All interface texts of the site, grouped like the pages that show them. */
export default async function InterfaceTextsPage({
  searchParams,
}: PageProps<'/admin/pages/interface-texts'>) {
  await requirePermission(Permission.PagesView);
  const basePath = pagesAreaHref(PagesArea.InterfaceTexts);
  const { locale, defaultLocale, locales } = await resolveEditorLocale(
    await searchParams,
    basePath,
  );
  const groups = await loadUiTextGroups(await getDb(), {
    namespaces: uiTextCatalog.namespaceIds,
    locale,
    mainLocale: defaultLocale,
  });
  return (
    <InterfaceTextsOverview
      key={locale}
      groups={groups}
      locale={locale}
      locales={locales}
      basePath={basePath}
    />
  );
}
