import 'server-only';

import { contentRegistry } from '@/core/content/project-registry';
import type { UiTextUser, UiTextUserKind } from '@/core/content/registry';
import type { Database } from '@/core/db/types';
import { adminHref, AdminRoute, PagesArea, pagesAreaHref } from '@/core/project/paths';

import type { UiTextGroup, UiTextUserLink } from './editor-types';
import { resolveUiText } from './model';
import { uiTextCatalog } from './project-catalog';
import { readAllUiTexts } from './repository';

function userHref(user: UiTextUser): string {
  switch (user.kind) {
    case 'page':
      return `${adminHref(AdminRoute.Pages)}/${user.id}`;
    case 'global':
      return pagesAreaHref(PagesArea.SiteWide, user.id);
    case 'collection':
      return pagesAreaHref(PagesArea.Collections, user.id);
    case 'form':
      return pagesAreaHref(PagesArea.Forms, user.id);
  }
}

/** Namespaces a document declares (`uiTexts: [...]`); items use their collection's. */
export function namespacesOf(kind: UiTextUserKind, id: string): readonly string[] {
  return contentRegistry.uiTextsOf(kind, id);
}

/**
 * The interface texts of some namespaces in one language, with where else they
 * appear. `exclude` is the document being edited (not listed in "Also on").
 */
export async function loadUiTextGroups(
  db: Database,
  input: {
    namespaces: readonly string[];
    locale: string;
    mainLocale: string;
    exclude?: { kind: UiTextUserKind; id: string };
  },
): Promise<UiTextGroup[]> {
  const { locale, mainLocale } = input;
  const stored = await readAllUiTexts(db, [locale, mainLocale]);
  return input.namespaces.flatMap((namespace) => {
    const definition = uiTextCatalog.namespaces[namespace];
    if (!definition) return [];
    const rows = stored[namespace] ?? {};
    const layers = {
      overrides: Object.fromEntries(Object.entries(rows).map(([code, row]) => [code, row.data])),
      locale,
      mainLocale,
    };
    const alsoOn: UiTextUserLink[] = contentRegistry
      .uiTextUsers(namespace)
      .filter((user) => user.kind !== input.exclude?.kind || user.id !== input.exclude.id)
      .map((user) => ({ id: `${user.kind}:${user.id}`, label: user.label, href: userHref(user) }));
    return [
      {
        namespace,
        label: definition.label,
        version: rows[locale]?.version ?? 0,
        alsoOn,
        texts: uiTextCatalog.keys(namespace).map((key) => {
          const resolved = resolveUiText(uiTextCatalog, namespace, key, layers);
          return {
            key,
            label: definition.texts[key] ?? key,
            value: resolved.value,
            source: resolved.source,
            inherited: resolved.inherited,
          };
        }),
      },
    ];
  });
}
