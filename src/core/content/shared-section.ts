import type { ProjectLocale } from '@project/config';

import type {
  ContentSchema,
  ResolvedSection,
  SectionDefinition,
  SectionList,
  SeedSection,
} from './define';
import type { FieldMap } from './fields';

/**
 * Shared sections: a section of page content that appears on several pages
 * (CTA band, testimonials, "why us"). It is defined once, placed in each page's
 * `sections` with `useShared()` (in site order), stored once, and editable from
 * every page that uses it. See docs/CONTENT_SCHEMA.md § Shared sections and
 * docs/DECISIONS.md D-087. Globals stay for layout chrome (header, footer,
 * contacts, socials); a repeated section of page content is a shared section.
 */

/** A section placed in a page with `useShared()`: same shape as a page section, plus its shared id. */
export interface SharedSection<
  Id extends string = string,
  F extends FieldMap = FieldMap,
> extends SectionDefinition<Id, F> {
  readonly sharedId: Id;
}

export interface SharedSectionInput<Id extends string, F extends FieldMap> {
  /** Stable DB key, kebab-case (also the section id in pages). Never rename after launch. */
  readonly id: Id;
  readonly label: string;
  readonly description?: string;
  readonly fields: F;
  /** Initial content per locale (flat: `{ title: '…' }`). */
  readonly seed?: Partial<Record<ProjectLocale, SeedSection<F>>>;
}

export interface SharedSectionDefinition<
  Id extends string = string,
  F extends FieldMap = FieldMap,
> extends SharedSectionInput<Id, F> {
  /** The section to place in pages (what `useShared()` returns). */
  readonly section: SharedSection<Id, F>;
  /** One-section schema used for storage, seeding and validation (`{ [id]: values }`). */
  readonly schema: ContentSchema;
}

export type AnySharedSection = SharedSectionDefinition<string, FieldMap>;

/** Content of a shared section as the site receives it (same as a page section). */
export type SharedSectionContent<S extends AnySharedSection> = ResolvedSection<S['fields']>;

export function defineSharedSection<const Id extends string, const F extends FieldMap>(
  input: SharedSectionInput<Id, F>,
): SharedSectionDefinition<Id, F> {
  for (const key of Object.keys(input.fields)) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) {
      throw new Error(
        `Shared section "${input.id}": field key "${key}" must be camelCase alphanumeric.`,
      );
    }
  }
  const section: SharedSection<Id, F> = {
    id: input.id,
    sharedId: input.id,
    label: input.label,
    ...(input.description ? { description: input.description } : {}),
    fields: input.fields,
  };
  const seed: Record<string, object> = {};
  for (const [locale, values] of Object.entries(input.seed ?? {}))
    seed[locale] = { [input.id]: values };
  return { ...input, section, schema: { sections: [section], seed } };
}

/**
 * Places a shared section in a page's `sections` (in site order). The page's
 * content then has the shared values under the section id, typed like any section.
 */
// Not a React hook: a plain function used in content schemas (the name is the public API).
export function useShared<const Id extends string, const F extends FieldMap>(
  shared: SharedSectionDefinition<Id, F>,
): SharedSection<Id, F> {
  return shared.section;
}

/** Storage key of a shared section in the page tables (page ids are kebab-case: no collisions). */
export function sharedKey(id: string): string {
  return `shared:${id}`;
}

export function isSharedSection(section: SectionDefinition): section is SharedSection {
  return typeof (section as Partial<SharedSection>).sharedId === 'string';
}

/** Shared sections a page uses, in site order. */
export function sharedUses(schema: { readonly sections: SectionList }): SharedSection[] {
  return schema.sections.filter(isSharedSection);
}

/**
 * The part of a page stored with the page itself: its own sections and seed
 * (shared sections are stored once, under their own key).
 */
export function ownSchema(schema: ContentSchema): ContentSchema {
  const sections = schema.sections.filter((section) => !isSharedSection(section));
  if (sections.length === schema.sections.length) return schema;
  return { sections, ...(schema.seed ? { seed: schema.seed } : {}) };
}
