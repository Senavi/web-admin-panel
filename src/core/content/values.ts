import type { ContentSchema, SeedImage } from './define';
import {
  type AnyField,
  FieldKind,
  type ImageValue,
  type ListItemFields,
  newListItemKey,
} from './fields';
import { parseStoredValue } from './validation';

/**
 * Pure helpers to split edited content into shared + localized storage, merge
 * it back, and resolve fallbacks. Storage layout (docs/CONTENT_SCHEMA.md):
 *
 *   page_content(page, '_shared') → non-localized values
 *   page_content(page, '<locale>') → localized values (+ alt text of shared images)
 */

export type JsonRecord = Record<string, unknown>;
/** `{ [sectionId]: { [fieldKey]: value } }` */
export type ContentRecord = Record<string, JsonRecord>;

export interface StoredRows {
  readonly shared: ContentRecord | undefined;
  readonly localized: ContentRecord | undefined;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sectionOf(record: ContentRecord | undefined, sectionId: string): JsonRecord {
  const section = record?.[sectionId];
  return isRecord(section) ? section : {};
}

/** Splits a full locale content object into the shared and localized records to store. */
export function splitContent(
  page: ContentSchema,
  content: ContentRecord,
): { shared: ContentRecord; localized: ContentRecord } {
  const shared: ContentRecord = {};
  const localized: ContentRecord = {};
  for (const section of page.sections) {
    const values = sectionOf(content, section.id);
    const sharedSection: JsonRecord = {};
    const localizedSection: JsonRecord = {};
    for (const [key, field] of Object.entries(section.fields)) {
      if (!(key in values)) continue;
      const value = values[key];
      if (field.localized) {
        localizedSection[key] = value;
      } else if (field.kind === FieldKind.Image && isRecord(value)) {
        sharedSection[key] = { mediaId: value.mediaId ?? null };
        localizedSection[key] = { alt: value.alt ?? '' };
      } else {
        sharedSection[key] = value;
      }
    }
    shared[section.id] = sharedSection;
    localized[section.id] = localizedSection;
  }
  return { shared, localized };
}

/** Raw (unvalidated) value of one field from stored rows; undefined when missing. */
function storedRaw(field: AnyField, key: string, sectionId: string, rows: StoredRows): unknown {
  const sharedValue = sectionOf(rows.shared, sectionId)[key];
  const localizedValue = sectionOf(rows.localized, sectionId)[key];
  if (field.localized) return localizedValue;
  if (field.kind !== FieldKind.Image) return sharedValue;
  if (!isRecord(sharedValue) && !isRecord(localizedValue)) return undefined;
  return {
    mediaId: isRecord(sharedValue) ? (sharedValue.mediaId ?? null) : null,
    alt:
      isRecord(localizedValue) && typeof localizedValue.alt === 'string' ? localizedValue.alt : '',
  };
}

/** Seed content for one locale, already converted to stored values. */
export type ResolvedSeed = ContentRecord | undefined;

export interface FallbackChain {
  /** Rows of the requested locale. */
  readonly primary: StoredRows;
  /** Rows of the default locale (localized fallback). */
  readonly defaultLocale?: StoredRows;
  /** Seed content of the requested locale, then of the default locale. */
  readonly seeds: readonly ResolvedSeed[];
}

/**
 * Full content for a locale: stored value → default-locale value → seed → field default.
 * Invalid stored values (e.g. after a schema change) are treated as missing.
 */
export function resolveWithFallback(page: ContentSchema, chain: FallbackChain): ContentRecord {
  const result: ContentRecord = {};
  for (const section of page.sections) {
    const out: JsonRecord = {};
    for (const [key, field] of Object.entries(section.fields)) {
      const candidates: unknown[] = [storedRaw(field, key, section.id, chain.primary)];
      if (chain.defaultLocale)
        candidates.push(storedRaw(field, key, section.id, chain.defaultLocale));
      for (const seed of chain.seeds) candidates.push(sectionOf(seed, section.id)[key]);

      let value: unknown;
      for (const candidate of candidates) {
        value = parseStoredValue(field, candidate);
        if (value !== undefined) break;
      }
      out[key] = value ?? field.defaultValue;
    }
    result[section.id] = out;
  }
  return result;
}

/** Content for a locale without any fallback (missing values → field defaults). Used for completeness. */
export function mergeWithoutFallback(page: ContentSchema, rows: StoredRows): ContentRecord {
  return resolveWithFallback(page, { primary: rows, seeds: [] });
}

/**
 * Converts seed content (with `{ asset, alt }` images and items without keys)
 * into stored values, using `assetIds` to map seed asset names to media ids.
 */
export function seedToStored(
  page: ContentSchema,
  seed: ContentRecord | undefined,
  assetIds: ReadonlyMap<string, string>,
): ContentRecord | undefined {
  if (!seed) return undefined;
  const result: ContentRecord = {};
  for (const section of page.sections) {
    const values = sectionOf(seed, section.id);
    const out: JsonRecord = {};
    for (const [key, field] of Object.entries(section.fields)) {
      if (key in values) out[key] = seedValueToStored(field, values[key], assetIds);
    }
    result[section.id] = out;
  }
  return result;
}

function seedValueToStored(
  field: AnyField,
  value: unknown,
  assetIds: ReadonlyMap<string, string>,
): unknown {
  if (field.kind === FieldKind.Image) {
    const seed = value as Partial<SeedImage> | undefined;
    const image: ImageValue = {
      mediaId: (seed?.asset && assetIds.get(seed.asset)) || null,
      alt: seed?.alt ?? '',
    };
    return image;
  }
  if (field.kind === FieldKind.List && Array.isArray(value)) {
    return value.map((item: unknown) =>
      listItemFromSeed(field.of, isRecord(item) ? item : {}, assetIds),
    );
  }
  return value;
}

function listItemFromSeed(
  of: ListItemFields,
  item: JsonRecord,
  assetIds: ReadonlyMap<string, string>,
): JsonRecord {
  const out: JsonRecord = { _key: typeof item._key === 'string' ? item._key : newListItemKey() };
  for (const [key, field] of Object.entries(of)) {
    out[key] = key in item ? seedValueToStored(field, item[key], assetIds) : field.defaultValue;
  }
  return out;
}

/** All seed asset names referenced by a page's seeds (any locale). */
export function seedAssets(page: ContentSchema): string[] {
  const assets = new Set<string>();
  const visit = (field: AnyField, value: unknown) => {
    if (field.kind === FieldKind.Image && isRecord(value) && typeof value.asset === 'string')
      assets.add(value.asset);
    if (field.kind === FieldKind.List && Array.isArray(value)) {
      for (const item of value) {
        if (!isRecord(item)) continue;
        for (const [key, child] of Object.entries(field.of)) visit(child, item[key]);
      }
    }
  };
  for (const seed of Object.values(page.seed ?? {})) {
    for (const section of page.sections) {
      const values = sectionOf(seed as ContentRecord, section.id);
      for (const [key, field] of Object.entries(section.fields)) visit(field, values[key]);
    }
  }
  return [...assets];
}

/** Every media id referenced by resolved content (for one batched lookup). */
export function collectMediaIds(page: ContentSchema, content: ContentRecord): string[] {
  const ids = new Set<string>();
  const visit = (field: AnyField, value: unknown) => {
    if (field.kind === FieldKind.Image && isRecord(value) && typeof value.mediaId === 'string')
      ids.add(value.mediaId);
    if (field.kind === FieldKind.List && Array.isArray(value)) {
      for (const item of value) {
        if (!isRecord(item)) continue;
        for (const [key, child] of Object.entries(field.of)) visit(child, item[key]);
      }
    }
  };
  for (const section of page.sections) {
    const values = sectionOf(content, section.id);
    for (const [key, field] of Object.entries(section.fields)) visit(field, values[key]);
  }
  return [...ids];
}

/** Replaces image values with resolved media (or null) for the public site. */
export function resolveImages<T>(
  page: ContentSchema,
  content: ContentRecord,
  resolve: (image: ImageValue) => T | null,
): ContentRecord {
  const map = (field: AnyField, value: unknown): unknown => {
    if (field.kind === FieldKind.Image)
      return isRecord(value) ? resolve(value as unknown as ImageValue) : null;
    if (field.kind === FieldKind.List && Array.isArray(value)) {
      return value.map((item: unknown) => {
        if (!isRecord(item)) return item;
        const out: JsonRecord = { _key: item._key };
        for (const [key, child] of Object.entries(field.of)) out[key] = map(child, item[key]);
        return out;
      });
    }
    return value;
  };
  const result: ContentRecord = {};
  for (const section of page.sections) {
    const values = sectionOf(content, section.id);
    const out: JsonRecord = {};
    for (const [key, field] of Object.entries(section.fields)) out[key] = map(field, values[key]);
    result[section.id] = out;
  }
  return result;
}

/** Field keys stored for a page that no longer exist in the schema (reported by content:sync). */
export function findOrphans(page: ContentSchema, record: ContentRecord | undefined): string[] {
  if (!record) return [];
  const orphans: string[] = [];
  for (const [sectionId, values] of Object.entries(record)) {
    const section = page.sections.find((candidate) => candidate.id === sectionId);
    if (!section) {
      orphans.push(sectionId);
      continue;
    }
    if (!isRecord(values)) continue;
    for (const key of Object.keys(values)) {
      if (!(key in section.fields)) orphans.push(`${sectionId}.${key}`);
    }
  }
  return orphans;
}
