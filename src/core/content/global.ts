import type { ProjectLocale } from '@project/config';

import type { PageSeed, ResolvedPageContent, SectionList } from './define';

/**
 * Global content: values shared by many pages (header/footer texts, contacts,
 * social links, legal line). Same sections/fields/seed as a page, but no route
 * and no SEO. Edited in Pages → Site-wide. See docs/CONTENT_SCHEMA.md § Globals.
 */
export interface GlobalDefinition<Id extends string = string, S extends SectionList = SectionList> {
  /** Stable DB key, kebab-case. Never rename after launch. */
  readonly id: Id;
  /** Admin label, e.g. "Header & footer". */
  readonly label: string;
  readonly sections: S;
  readonly seed?: Partial<Record<ProjectLocale, PageSeed<S>>>;
}

export type AnyGlobal = GlobalDefinition<string, SectionList>;

/** Content of a global as the site receives it (`getGlobalContent`). */
export type ResolvedGlobalContent<S extends SectionList> = ResolvedPageContent<S>;

/** Storage key of a global in the page tables (page ids are kebab-case, so no collisions). */
export function globalKey(id: string): string {
  return `global:${id}`;
}

export function defineGlobal<const Id extends string, const S extends SectionList>(
  global: GlobalDefinition<Id, S>,
): GlobalDefinition<Id, S> {
  const ids = global.sections.map((section) => section.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Global "${global.id}" has duplicate section ids.`);
  }
  return global;
}
