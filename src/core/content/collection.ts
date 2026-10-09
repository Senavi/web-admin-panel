import type { ProjectLocale } from '@project/config';

import type { JsonLdObject } from '@/core/seo/json-ld';

import type { ContentSchema, ResolvedSection, SectionDefinition, SeedSection } from './define';
import type { FieldMap } from './fields';

/**
 * Collections: repeatable items with their own URL (`/blog/:slug`), such as
 * posts, projects or vacancies. Developers define the fields; editors create,
 * publish and delete items. See docs/CONTENT_SCHEMA.md § Collections.
 */

export const CollectionItemStatus = {
  Draft: 'draft',
  Published: 'published',
} as const;
export type CollectionItemStatus = (typeof CollectionItemStatus)[keyof typeof CollectionItemStatus];

export const MissingTranslation = {
  /** Show the default-locale content (per field) when an item isn't translated. */
  Fallback: 'fallback',
  /** Hide the item in locales without a translation. */
  Hide: 'hide',
} as const;
export type MissingTranslation = (typeof MissingTranslation)[keyof typeof MissingTranslation];

export const StructuredDataType = {
  Article: 'Article',
  BlogPosting: 'BlogPosting',
  NewsArticle: 'NewsArticle',
} as const;
export type StructuredDataType = (typeof StructuredDataType)[keyof typeof StructuredDataType];

/** Sort by publish date (`publishedAt`) or by a field of the collection. */
export interface CollectionSort<F extends FieldMap> {
  readonly by: 'publishedAt' | (keyof F & string);
  readonly direction: 'asc' | 'desc';
}

export interface CollectionStructuredDataContext<F extends FieldMap> {
  readonly locale: string;
  /** Absolute canonical URL of the item. */
  readonly url: string;
  readonly title: string;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
  readonly content: ResolvedSection<F>;
}

export interface CollectionSeedItem<F extends FieldMap> {
  readonly slug: string;
  /** ISO date (`2026-01-15`). Seed items are published unless `status` says otherwise. */
  readonly publishedAt?: string;
  readonly status?: CollectionItemStatus;
  readonly content: Partial<Record<ProjectLocale, SeedSection<F>>>;
}

export interface CollectionInput<Id extends string, F extends FieldMap> {
  /** Stable DB key, kebab-case. Never rename after launch. */
  readonly id: Id;
  /** Admin group label, e.g. "Blog". */
  readonly label: string;
  /** Singular item label, e.g. "Post" ("New post"). */
  readonly itemLabel: string;
  /** Registered page that renders the list. */
  readonly listPageId: string;
  /** Item URL pattern, must start with the list page path, e.g. `/blog/:slug`. */
  readonly itemPath: `/${string}/:slug`;
  readonly fields: F;
  /** Used for the admin table, default SEO title and slug suggestion. */
  readonly titleField: keyof F & string;
  /** Default meta description. */
  readonly summaryField?: keyof F & string;
  /** Default OG image. */
  readonly imageField?: keyof F & string;
  readonly sort?: CollectionSort<F>;
  readonly pageSize?: number;
  readonly missingTranslation?: MissingTranslation;
  readonly structuredData?:
    | StructuredDataType
    | 'none'
    | ((context: CollectionStructuredDataContext<F>) => readonly JsonLdObject[]);
  readonly seed?: readonly CollectionSeedItem<F>[];
}

/** Structured data option as stored on a definition (field types erased for `AnyCollection`). */
export type StoredStructuredData =
  | StructuredDataType
  | 'none'
  | ((context: CollectionStructuredDataContext<FieldMap>) => readonly JsonLdObject[]);

export interface CollectionDefinition<
  Id extends string = string,
  F extends FieldMap = FieldMap,
> extends Omit<
  CollectionInput<Id, F>,
  'structuredData' | 'sort' | 'titleField' | 'summaryField' | 'imageField'
> {
  // Field names are validated by `defineCollection`; stored as plain strings so any
  // definition is assignable to `AnyCollection`.
  readonly titleField: string;
  readonly summaryField?: string;
  readonly imageField?: string;
  readonly structuredData?: StoredStructuredData;
  readonly sort: { readonly by: string; readonly direction: 'asc' | 'desc' };
  readonly pageSize: number;
  readonly missingTranslation: MissingTranslation;
  /** One internal section holding the fields (shared storage/editor code works on sections). */
  readonly schema: ContentSchema & { readonly sections: readonly [SectionDefinition<'item', F>] };
}

export type AnyCollection = CollectionDefinition<string, FieldMap>;

/** Internal section id of collection item fields (stored as `{ item: { …fields } }`). */
export const ITEM_SECTION = 'item';

export const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 100;
export const SLUG_PLACEHOLDER = ':slug';

export function defineCollection<const Id extends string, const F extends FieldMap>(
  input: CollectionInput<Id, F>,
): CollectionDefinition<Id, F> {
  const keys = Object.keys(input.fields);
  for (const key of keys) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) {
      throw new Error(
        `Collection "${input.id}": field key "${key}" must be camelCase alphanumeric.`,
      );
    }
  }
  for (const [option, key] of [
    ['titleField', input.titleField],
    ['summaryField', input.summaryField],
    ['imageField', input.imageField],
  ] as const) {
    if (key !== undefined && !keys.includes(key)) {
      throw new Error(`Collection "${input.id}": ${option} "${key}" is not a field.`);
    }
  }
  if (!/^\/([a-z0-9-]+\/)*:slug$/.test(input.itemPath)) {
    throw new Error(
      `Collection "${input.id}": itemPath "${input.itemPath}" must look like /blog/:slug.`,
    );
  }
  const sort = input.sort ?? { by: 'publishedAt', direction: 'desc' };
  if (sort.by !== 'publishedAt' && !keys.includes(sort.by)) {
    throw new Error(`Collection "${input.id}": sort field "${sort.by}" is not a field.`);
  }
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new Error(`Collection "${input.id}": pageSize must be 1–${MAX_PAGE_SIZE}.`);
  }
  const section: SectionDefinition<'item', F> = {
    id: ITEM_SECTION,
    label: input.itemLabel,
    fields: input.fields,
  };
  const { structuredData } = input;
  return {
    ...input,
    // The hook only ever receives this collection's own content (see buildItemStructuredData).
    structuredData: structuredData as StoredStructuredData | undefined,
    sort,
    pageSize,
    missingTranslation: input.missingTranslation ?? MissingTranslation.Fallback,
    schema: { sections: [section] },
  };
}

/** URL path of an item without locale prefix (`/blog/:slug` → `/blog/hello`). */
export function collectionItemPath(collection: Pick<AnyCollection, 'itemPath'>, slug: string) {
  return collection.itemPath.replace(SLUG_PLACEHOLDER, slug);
}

/** Path of the list page the items live under (`/blog/:slug` → `/blog`). */
export function collectionBasePath(collection: Pick<AnyCollection, 'itemPath'>): string {
  return collection.itemPath.slice(0, -`/${SLUG_PLACEHOLDER}`.length) || '/';
}

/** Seed of one item as a document schema seed (`{ [locale]: { item: … } }`). */
export function itemSeedSchema(
  collection: AnyCollection,
  seed: CollectionSeedItem<FieldMap>,
): ContentSchema {
  const bySection: Record<string, unknown> = {};
  for (const [locale, values] of Object.entries(seed.content))
    bySection[locale] = { [ITEM_SECTION]: values };
  return { sections: collection.schema.sections, seed: bySection };
}
