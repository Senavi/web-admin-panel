import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';

import { and, eq } from 'drizzle-orm';

import { projectConfig } from '@project/config';

import { collectionItems, collectionSeedLog, SHARED_LOCALE } from '@/core/db/schema';
import { SEED_ASSETS_DIR } from '@/core/db/paths';
import type { Database } from '@/core/db/types';
import { ingestImage } from '@/core/media/ingest';
import { seedAssetIds } from '@/core/media/resolve';
import type { StorageAdapter } from '@/core/storage/types';

import { CollectionItemStatus, itemSeedSchema } from './collection';
import type { ContentSchema } from './define';
import { contentRegistry as registry } from './project-registry';
import type { DocumentStore } from './store';
import { collectionItemStore, pageStore } from './stores/table-store';
import {
  type ContentRecord,
  findOrphans,
  type JsonRecord,
  seedAssets,
  seedToStored,
  splitContent,
} from './values';

export interface SyncReport {
  /** `collection/slug` items created from collection seeds. */
  readonly itemsCreated: string[];
  /** `page:locale` rows created. */
  readonly created: string[];
  /** `page:locale:section.field` values filled in existing rows. */
  readonly filled: string[];
  /** `page:locale:section.field` stored values no longer in the schema (not deleted). */
  readonly orphans: string[];
  readonly assetsImported: string[];
}

/**
 * Seeds missing pages and fields from the schema (seed content, then field
 * defaults) WITHOUT overwriting edited content, imports seed images once, and
 * reports orphaned fields. Idempotent: run it after every schema change.
 */
export async function syncContent(db: Database, storage: StorageAdapter): Promise<SyncReport> {
  const report: SyncReport = {
    itemsCreated: [],
    created: [],
    filled: [],
    orphans: [],
    assetsImported: [],
  };
  for (const page of registry.pages) {
    await syncDocument(
      db,
      storage,
      { label: page.id, key: page.id, schema: page, store: pageStore },
      report,
    );
  }
  for (const collection of registry.collections) {
    for (const seed of collection.seed ?? []) {
      const itemId = await ensureSeedItem(db, collection.id, seed);
      if (!itemId) continue;
      if (itemId.created) report.itemsCreated.push(`${collection.id}/${seed.slug}`);
      await syncDocument(
        db,
        storage,
        {
          label: `${collection.id}/${seed.slug}`,
          key: itemId.id,
          schema: itemSeedSchema(collection, seed),
          store: collectionItemStore,
        },
        report,
      );
    }
  }
  return report;
}

interface SyncTarget {
  /** Report prefix, e.g. `about` or `blog/hello-world`. */
  readonly label: string;
  readonly key: string;
  readonly schema: ContentSchema;
  readonly store: DocumentStore;
}

/**
 * Creates a seed item once (logged in `collection_seed_log`); returns its id,
 * or null when it was seeded before and has since been deleted or renamed.
 */
async function ensureSeedItem(
  db: Database,
  collectionId: string,
  seed: { slug: string; publishedAt?: string; status?: CollectionItemStatus },
): Promise<{ id: string; created: boolean } | null> {
  const [existing] = await db
    .select({ id: collectionItems.id })
    .from(collectionItems)
    .where(
      and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.slug, seed.slug)),
    );
  if (existing) return { id: existing.id, created: false };
  const logged = await db
    .insert(collectionSeedLog)
    .values({ collectionId, slug: seed.slug })
    .onConflictDoNothing()
    .returning({ slug: collectionSeedLog.slug });
  if (logged.length === 0) return null;
  const status = seed.status ?? CollectionItemStatus.Published;
  const [created] = await db
    .insert(collectionItems)
    .values({
      collectionId,
      slug: seed.slug,
      status,
      publishedAt: seed.publishedAt
        ? new Date(seed.publishedAt)
        : status === CollectionItemStatus.Published
          ? new Date()
          : null,
    })
    .returning({ id: collectionItems.id });
  return created ? { id: created.id, created: true } : null;
}

/** Seeds one document's missing rows and fields; reports orphans. */
async function syncDocument(
  db: Database,
  storage: StorageAdapter,
  target: SyncTarget,
  report: SyncReport,
): Promise<void> {
  const { schema, label } = target;
  const assetIds = await importSeedAssets(db, storage, schema, report);
  const seed = schema.seed as Partial<Record<string, ContentRecord>> | undefined;
  const rows = await target.store.readRows(db, target.key, projectConfig.localeCodes);
  const defaults = defaultContent(schema);
  const fill = (locale: string, existing: ContentRecord | undefined, data: ContentRecord) =>
    fillRow(db, target, locale, existing, rows.versions.get(locale) ?? 0, data, report);

  // Shared values: default-locale seed, then field defaults.
  const defaultSeed = seedToStored(schema, seed?.[projectConfig.defaultLocale], assetIds) ?? {};
  const sharedTarget = deepFill(
    splitContent(schema, defaultSeed).shared,
    splitContent(schema, defaults).shared,
  );
  await fill(SHARED_LOCALE, rows.shared, sharedTarget);

  // Localized values: only locales that have seed content (others fall back at read time).
  for (const locale of projectConfig.localeCodes) {
    const localeSeed = seedToStored(schema, seed?.[locale], assetIds);
    const isDefault = locale === projectConfig.defaultLocale;
    if (!localeSeed && !isDefault) continue;
    let localized = splitContent(schema, localeSeed ?? {}).localized;
    if (isDefault) localized = deepFill(localized, splitContent(schema, defaults).localized);
    await fill(locale, rows.byLocale.get(locale), localized);
  }

  for (const [locale, record] of [
    [SHARED_LOCALE, rows.shared] as const,
    ...rows.byLocale.entries(),
  ]) {
    for (const orphan of findOrphans(schema, record))
      report.orphans.push(`${label}:${locale}:${orphan}`);
  }
}

function defaultContent(page: ContentSchema): ContentRecord {
  const result: ContentRecord = {};
  for (const section of page.sections) {
    const values: JsonRecord = {};
    for (const [key, field] of Object.entries(section.fields)) values[key] = field.defaultValue;
    result[section.id] = values;
  }
  return result;
}

/** Adds keys from `fallback` that are missing in `base` (one level: section → field). */
function deepFill(base: ContentRecord, fallback: ContentRecord): ContentRecord {
  const result: ContentRecord = { ...base };
  for (const [sectionId, values] of Object.entries(fallback)) {
    result[sectionId] = { ...values, ...(base[sectionId] ?? {}) };
  }
  return result;
}

async function fillRow(
  db: Database,
  target: SyncTarget,
  locale: string,
  existing: ContentRecord | undefined,
  version: number,
  data: ContentRecord,
  report: SyncReport,
): Promise<void> {
  const context = { userId: null, now: new Date() };
  if (!existing) {
    await target.store.writeContent(db, target.key, locale, data, 0, context);
    report.created.push(`${target.label}:${locale}`);
    return;
  }
  const merged: ContentRecord = { ...existing };
  const filled: string[] = [];
  for (const [sectionId, values] of Object.entries(data)) {
    const current = { ...(existing[sectionId] ?? {}) };
    for (const [key, value] of Object.entries(values)) {
      if (!(key in current)) {
        current[key] = value;
        filled.push(`${target.label}:${locale}:${sectionId}.${key}`);
      }
    }
    merged[sectionId] = current;
  }
  if (filled.length === 0) return;
  await target.store.writeContent(db, target.key, locale, merged, version, context);
  report.filled.push(...filled);
}

async function importSeedAssets(
  db: Database,
  storage: StorageAdapter,
  page: ContentSchema,
  report: SyncReport,
): Promise<Map<string, string>> {
  const assets = seedAssets(page);
  const ids = await seedAssetIds(db, assets);
  for (const asset of assets) {
    if (ids.has(asset)) continue;
    const file = path.join(SEED_ASSETS_DIR, path.basename(asset));
    const bytes = new Uint8Array(await fs.readFile(file));
    const row = await ingestImage(db, storage, {
      bytes,
      originalName: asset,
      uploadedBy: null,
      seedAsset: asset,
    });
    ids.set(asset, row.id);
    report.assetsImported.push(asset);
  }
  return ids;
}
