import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';

import { and, eq, sql } from 'drizzle-orm';

import { projectConfig } from '@project/config';

import { registry } from '@/content';
import { SEED_ASSETS_DIR } from '@/core/db/paths';
import { pageContent, SHARED_LOCALE } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { ingestImage } from '@/core/media/ingest';
import { seedAssetIds } from '@/core/media/resolve';
import type { StorageAdapter } from '@/core/storage/types';

import type { AnyPage } from './define';
import { readPageRows } from './repository';
import {
  type ContentRecord,
  findOrphans,
  type JsonRecord,
  seedAssets,
  seedToStored,
  splitContent,
} from './values';

export interface SyncReport {
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
  const report: SyncReport = { created: [], filled: [], orphans: [], assetsImported: [] };
  for (const page of registry.pages) {
    const assetIds = await importSeedAssets(db, storage, page, report);
    const seed = page.seed as Partial<Record<string, ContentRecord>> | undefined;
    const rows = await readPageRows(db, page.id, projectConfig.localeCodes);
    const defaults = defaultContent(page);

    // Shared values: default-locale seed, then field defaults.
    const defaultSeed = seedToStored(page, seed?.[projectConfig.defaultLocale], assetIds) ?? {};
    const sharedTarget = deepFill(
      splitContent(page, defaultSeed).shared,
      splitContent(page, defaults).shared,
    );
    await fillRow(db, page.id, SHARED_LOCALE, rows.shared, sharedTarget, report);

    // Localized values: only locales that have seed content (others fall back at read time).
    for (const locale of projectConfig.localeCodes) {
      const localeSeed = seedToStored(page, seed?.[locale], assetIds);
      const isDefault = locale === projectConfig.defaultLocale;
      if (!localeSeed && !isDefault) continue;
      let target = splitContent(page, localeSeed ?? {}).localized;
      if (isDefault) target = deepFill(target, splitContent(page, defaults).localized);
      await fillRow(db, page.id, locale, rows.byLocale.get(locale), target, report);
    }

    for (const [locale, record] of [
      [SHARED_LOCALE, rows.shared] as const,
      ...rows.byLocale.entries(),
    ]) {
      for (const orphan of findOrphans(page, record))
        report.orphans.push(`${page.id}:${locale}:${orphan}`);
    }
  }
  return report;
}

function defaultContent(page: AnyPage): ContentRecord {
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
  pageId: string,
  locale: string,
  existing: ContentRecord | undefined,
  target: ContentRecord,
  report: SyncReport,
): Promise<void> {
  if (!existing) {
    await db.insert(pageContent).values({ pageId, locale, data: target }).onConflictDoNothing();
    report.created.push(`${pageId}:${locale}`);
    return;
  }
  const merged: ContentRecord = { ...existing };
  const filled: string[] = [];
  for (const [sectionId, values] of Object.entries(target)) {
    const current = { ...(existing[sectionId] ?? {}) };
    for (const [key, value] of Object.entries(values)) {
      if (!(key in current)) {
        current[key] = value;
        filled.push(`${pageId}:${locale}:${sectionId}.${key}`);
      }
    }
    merged[sectionId] = current;
  }
  if (filled.length === 0) return;
  await db
    .update(pageContent)
    .set({ data: merged, version: sql`${pageContent.version} + 1`, updatedAt: new Date() })
    .where(and(eq(pageContent.pageId, pageId), eq(pageContent.locale, locale)));
  report.filled.push(...filled);
}

async function importSeedAssets(
  db: Database,
  storage: StorageAdapter,
  page: AnyPage,
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
