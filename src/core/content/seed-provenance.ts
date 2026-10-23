import { createHash } from 'node:crypto';

import type { ContentSchema } from './define';
import type { AnyField } from './fields';
import { parseStoredValue } from './validation';
import type { ContentRecord, JsonRecord } from './values';

/**
 * Seed provenance (D-095): which seed value each stored field was last filled
 * from. `content:sync` moves a field to a newer seed only while its stored value
 * still equals the previously applied seed (nobody edited it); edited fields are
 * never touched. Pure: no database access (unit-tested).
 */

/** `"section.field"` → hash of the seed value last applied to that field. */
export type SeedHashes = Readonly<Record<string, string>>;

const fieldPath = (sectionId: string, key: string) => `${sectionId}.${key}`;

/** List item keys are generated per sync: they never count as a change. */
function withoutListKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutListKeys);
  if (value && typeof value === 'object') {
    const out: JsonRecord = {};
    for (const [key, child] of Object.entries(value as JsonRecord)) {
      if (key !== '_key' && child !== undefined) out[key] = withoutListKeys(child);
    }
    return out;
  }
  return value;
}

/** Deterministic JSON (sorted keys). */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as JsonRecord).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Hash of a stored field value, normalized the way the editor saves it (so a
 * save that didn't change the field doesn't make it look edited).
 */
export function seedValueHash(field: AnyField, value: unknown): string {
  const normalized = parseStoredValue(field, value) ?? value;
  return createHash('sha256')
    .update(canonical(withoutListKeys(normalized)))
    .digest('base64url')
    .slice(0, 22);
}

export interface SeedRowPlan {
  /** The row to store (unchanged when nothing was filled or updated). */
  readonly next: ContentRecord;
  /** `section.field` filled because the row didn't have it. */
  readonly filled: readonly string[];
  /** `section.field` moved to a newer seed (stored value was the previous seed). */
  readonly updated: readonly string[];
  /** Hashes to remember for this row. */
  readonly hashes: SeedHashes;
  readonly hashesChanged: boolean;
}

/**
 * Plans one content row (one document, one locale or `_shared`).
 * - No row yet: the seed row is created; every field's hash is recorded.
 * - Missing field: filled from the seed.
 * - Field with a recorded hash: if the seed changed and the stored value still
 *   equals the previous seed, it takes the new seed; otherwise it is kept.
 * - Field without a recorded hash (first sync after upgrading): kept, the
 *   current seed's hash is recorded. Nothing changes on that sync.
 */
export function planSeedRow(
  schema: ContentSchema,
  current: ContentRecord | undefined,
  target: ContentRecord,
  applied: SeedHashes | undefined,
): SeedRowPlan {
  const hashes: Record<string, string> = { ...(applied ?? {}) };
  const filled: string[] = [];
  const updated: string[] = [];
  const next: ContentRecord = { ...(current ?? {}) };

  for (const section of schema.sections) {
    const values = target[section.id];
    if (!values) continue;
    const row: JsonRecord = { ...(current?.[section.id] ?? {}) };
    for (const [key, value] of Object.entries(values)) {
      const field = section.fields[key];
      if (!field) continue;
      const path = fieldPath(section.id, key);
      const seedHash = seedValueHash(field, value);
      const previous = applied?.[path];
      if (!current) {
        row[key] = value;
      } else if (!(key in row)) {
        row[key] = value;
        filled.push(path);
      } else if (
        previous !== undefined &&
        previous !== seedHash &&
        seedValueHash(field, row[key]) === previous
      ) {
        row[key] = value;
        updated.push(path);
      }
      hashes[path] = seedHash;
    }
    next[section.id] = row;
  }

  const hashesChanged = canonical(hashes) !== canonical(applied ?? {});
  return { next: current ? next : target, filled, updated, hashes, hashesChanged };
}

/**
 * Code defaults of a document for one locale, as full editor content: the
 * locale's seed, then the main language's seed, then field defaults (what a
 * fresh database shows). `seeds` are stored-shape seeds (images as media ids).
 */
export function codeDefaultContent(
  schema: ContentSchema,
  seeds: ReadonlyArray<ContentRecord | undefined>,
): ContentRecord {
  const result: ContentRecord = {};
  for (const section of schema.sections) {
    const out: JsonRecord = {};
    for (const [key, field] of Object.entries(section.fields)) {
      let value: unknown;
      for (const seed of seeds) {
        value = parseStoredValue(field, seed?.[section.id]?.[key]);
        if (value !== undefined) break;
      }
      out[key] = value ?? field.defaultValue;
    }
    result[section.id] = out;
  }
  return result;
}

/** Fields whose current value differs from the code default (for the reset confirmation). */
export function changedFields(
  schema: ContentSchema,
  current: ContentRecord,
  defaults: ContentRecord,
  sectionIds?: ReadonlySet<string>,
): Array<{ readonly sectionId: string; readonly key: string }> {
  const changes: Array<{ sectionId: string; key: string }> = [];
  for (const section of schema.sections) {
    if (sectionIds && !sectionIds.has(section.id)) continue;
    for (const [key, field] of Object.entries(section.fields)) {
      const now = current[section.id]?.[key] ?? field.defaultValue;
      const code = defaults[section.id]?.[key] ?? field.defaultValue;
      if (seedValueHash(field, now) !== seedValueHash(field, code))
        changes.push({ sectionId: section.id, key });
    }
  }
  return changes;
}
