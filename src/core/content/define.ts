import type { ProjectLocale } from '@project/config';

import type { JsonLdObject } from '@/core/seo/json-ld';

import type {
  AnyField,
  FieldMap,
  ImageField,
  ListField,
  ListItemFields,
  StoredValue,
} from './fields';

/**
 * Pages and sections. Pages are fixed in code (developers define structure);
 * admins edit their content and SEO. See docs/CONTENT_SCHEMA.md.
 */

export interface SectionDefinition<Id extends string = string, F extends FieldMap = FieldMap> {
  readonly id: Id;
  readonly label: string;
  readonly description?: string;
  readonly fields: F;
}

export interface PageSeoDefaults {
  readonly title: string;
  readonly description?: string;
  /** Per-locale defaults (fall back to `title` / `description`). */
  readonly localized?: Partial<
    Record<ProjectLocale, { readonly title: string; readonly description?: string }>
  >;
}

/** Schema SEO defaults for a locale. */
export function seoDefaultsFor(
  page: Pick<PageDefinition, 'seo'>,
  locale: string,
): { title: string; description: string } {
  const localized = page.seo.localized?.[locale as ProjectLocale];
  return {
    title: localized?.title ?? page.seo.title,
    description: localized?.description ?? page.seo.description ?? '',
  };
}

export type SectionList = readonly SectionDefinition[];

// ── Value types derived from a schema ───────────────────────────────────────

export type SectionValue<F extends FieldMap> = { readonly [K in keyof F]: StoredValue<F[K]> };

/** Content of a page as stored/edited: `{ [sectionId]: { [field]: value } }`. */
export type PageContent<S extends SectionList> = {
  readonly [Sec in S[number] as Sec['id']]: SectionValue<Sec['fields']>;
};

/** Image as the public site receives it: resolved media, ready for `next/image`. */
export interface ResolvedImage {
  readonly id: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly blurDataURL: string | null;
}

export type ResolvedValue<F> = F extends ImageField
  ? ResolvedImage | null
  : F extends ListField<infer I>
    ? ReadonlyArray<{ readonly _key: string } & { readonly [K in keyof I]: ResolvedValue<I[K]> }>
    : StoredValue<F>;

export type ResolvedSection<F extends FieldMap> = { readonly [K in keyof F]: ResolvedValue<F[K]> };

/** Content of a page as the public site receives it (`getPageContent`). */
export type ResolvedPageContent<S extends SectionList> = {
  readonly [Sec in S[number] as Sec['id']]: ResolvedSection<Sec['fields']>;
};

// ── Seed content ─────────────────────────────────────────────────────────────

/** Seed images reference files in `src/content/seed/assets/` by name. */
export interface SeedImage {
  readonly asset: string;
  readonly alt: string;
}

export type SeedValue<F> = F extends ImageField
  ? SeedImage
  : F extends ListField<infer I extends ListItemFields>
    ? ReadonlyArray<{ readonly [K in keyof I]?: SeedValue<I[K]> }>
    : StoredValue<F>;

export type SeedSection<F extends FieldMap> = { readonly [K in keyof F]?: SeedValue<F[K]> };

export type PageSeed<S extends SectionList> = {
  readonly [Sec in S[number] as Sec['id']]?: SeedSection<Sec['fields']>;
};

export interface PageDefinition<Id extends string = string, S extends SectionList = SectionList> {
  readonly id: Id;
  /** URL path without locale prefix, e.g. `/`, `/about`, `/about/team`. */
  readonly path: `/${string}`;
  readonly label: string;
  /** Parent page id: builds the page tree in the admin. */
  readonly parent: string | null;
  readonly sections: S;
  readonly seo: PageSeoDefaults;
  /** Initial content per locale (from the design). Used by `content:sync` and as fallback. */
  readonly seed?: Partial<Record<ProjectLocale, PageSeed<S>>>;
  /** Extra schema.org objects for this page (added to breadcrumbs / site JSON-LD). */
  readonly structuredData?: (context: StructuredDataContext) => readonly JsonLdObject[];
}

export interface StructuredDataContext {
  readonly locale: string;
  /** Absolute canonical URL of the page. */
  readonly url: string;
  readonly title: string;
}

export function defineSection<const Id extends string, const F extends FieldMap>(
  section: SectionDefinition<Id, F>,
): SectionDefinition<Id, F> {
  for (const key of Object.keys(section.fields)) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) {
      throw new Error(
        `Section "${section.id}": field key "${key}" must be camelCase alphanumeric.`,
      );
    }
  }
  return section;
}

export function definePage<const Id extends string, const S extends SectionList>(
  page: PageDefinition<Id, S>,
): PageDefinition<Id, S> {
  const ids = page.sections.map((section) => section.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Page "${page.id}" has duplicate section ids.`);
  }
  if (!/^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/.test(page.path)) {
    throw new Error(
      `Page "${page.id}": path "${page.path}" must be lowercase segments like /about/team.`,
    );
  }
  return page;
}

export type AnyPage = PageDefinition<string, SectionList>;

/** Iterates every (section, key, field) of a page. */
export function* eachField(
  page: AnyPage,
): Generator<{ section: SectionDefinition; key: string; field: AnyField }> {
  for (const section of page.sections) {
    for (const [key, field] of Object.entries(section.fields)) {
      yield { section, key, field };
    }
  }
}
