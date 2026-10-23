import 'server-only';

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { and, eq, inArray } from 'drizzle-orm';

import { projectConfig } from '@project/config';

import {
  collectionItems,
  collectionSeedLog,
  contentSeedState,
  media,
  SHARED_LOCALE,
} from '@/core/db/schema';
import { SEED_ASSETS_DIR } from '@/core/db/paths';
import type { Database } from '@/core/db/types';
import { ingestImage } from '@/core/media/ingest';
import { parsePageSeo } from '@/core/seo/page-seo';
import { AuditAction, writeAudit } from '@/core/security/audit';
import type { StorageAdapter } from '@/core/storage/types';

import { CollectionItemStatus, itemSeedSchema } from './collection';
import type { ContentSchema } from './define';
import { globalKey } from './global';
import { type AnySharedSection, ownSchema, sharedKey } from './shared-section';
import { formKey } from '@/core/forms/define';
import { contentRegistry as registry } from './project-registry';
import { planSeedRow, type SeedHashes } from './seed-provenance';
import { type DocumentStore, MAX_REVISIONS } from './store';
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
  /** `page:locale:section.field` untouched values moved to a changed seed ("updated from code"). */
  readonly updated: string[];
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
    updated: [],
    orphans: [],
    assetsImported: [],
  };
  for (const page of registry.pages) {
    await syncDocument(
      db,
      storage,
      { label: page.id, key: page.id, schema: ownSchema(page), ...PAGE_STORE },
      report,
    );
  }
  for (const global of registry.globals) {
    await syncDocument(
      db,
      storage,
      { label: globalKey(global.id), key: globalKey(global.id), schema: global, ...PAGE_STORE },
      report,
    );
  }
  for (const form of registry.forms) {
    await syncDocument(
      db,
      storage,
      { label: formKey(form.id), key: formKey(form.id), schema: form.texts, ...PAGE_STORE },
      report,
    );
  }
  for (const shared of registry.sharedSections) {
    const key = sharedKey(shared.id);
    await adoptSharedContent(db, shared, report);
    await syncDocument(
      db,
      storage,
      { label: key, key, schema: shared.schema, ...PAGE_STORE },
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
          ...ITEM_STORE,
        },
        report,
      );
    }
  }
  if (report.updated.length > 0) {
    // One summary entry per sync (each document also gets a system revision).
    await writeAudit(db, {
      action: AuditAction.ContentCodeUpdate,
      target: 'content:sync',
      summary: {
        fields: report.updated.length,
        documents: updatedDocuments(report),
      },
    });
  }
  return report;
}

/** Documents with fields updated from code: `about:en:hero.title` → `about`. */
export function updatedDocuments(report: Pick<SyncReport, 'updated'>): string[] {
  return [...new Set(report.updated.map((entry) => entry.split(':').slice(0, -2).join(':')))];
}

/** Name shown in revision history for updates made by `content:sync`. */
export const CODE_UPDATE_AUTHOR = 'Update from code';
/** Revision kept before the first code update of a document nobody saved yet. */
export const BEFORE_CODE_UPDATE_AUTHOR = 'Before update from code';

/** Stores and their provenance scope (`content_seed_state.scope`). */
export const SeedScope = { Page: 'page', Item: 'item' } as const;
const PAGE_STORE = { store: pageStore, scope: SeedScope.Page } as const;
const ITEM_STORE = { store: collectionItemStore, scope: SeedScope.Item } as const;

/**
 * First sync of a shared section: if it has no rows yet, it adopts the values
 * saved under its id on a page that uses it (in registry order) or in a global
 * section with the same id. Moving a repeated section into a shared section
 * therefore keeps the edited content. The old values stay where they were
 * (reported as orphans, never deleted).
 */
async function adoptSharedContent(
  db: Database,
  shared: AnySharedSection,
  report: SyncReport,
): Promise<void> {
  const key = sharedKey(shared.id);
  const locales = [SHARED_LOCALE, ...projectConfig.localeCodes];
  const existing = await pageStore.readRows(db, key, projectConfig.localeCodes);
  if (existing.versions.size > 0) return;
  const sources = [
    ...registry.pagesUsingShared(shared.id).map((page) => page.id),
    ...registry.globals
      .filter((global) => global.sections.some((section) => section.id === shared.id))
      .map((global) => globalKey(global.id)),
  ];
  const context = { userId: null, now: new Date() };
  for (const source of sources) {
    const rows = await pageStore.readRows(db, source, projectConfig.localeCodes);
    const valuesFor = (locale: string) =>
      locale === SHARED_LOCALE ? rows.shared?.[shared.id] : rows.byLocale.get(locale)?.[shared.id];
    if (!locales.some((locale) => valuesFor(locale))) continue;
    for (const locale of locales) {
      const values = valuesFor(locale);
      if (values)
        await pageStore.writeContent(db, key, locale, { [shared.id]: values }, 0, context);
    }
    report.created.push(`${key} (from ${source})`);
    return;
  }
}

interface SyncTarget {
  /** Report prefix, e.g. `about` or `blog/hello-world`. */
  readonly label: string;
  readonly key: string;
  readonly schema: ContentSchema;
  readonly store: DocumentStore;
  readonly scope: string;
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

/** Seed content of a document per row (`_shared` + locales with seed), as stored values. */
function seedRows(schema: ContentSchema, assetIds: ReadonlyMap<string, string>) {
  const seed = schema.seed as Partial<Record<string, ContentRecord>> | undefined;
  const defaults = defaultContent(schema);
  const rows = new Map<string, ContentRecord>();
  // Shared values: default-locale seed, then field defaults.
  const defaultSeed = seedToStored(schema, seed?.[projectConfig.defaultLocale], assetIds) ?? {};
  rows.set(
    SHARED_LOCALE,
    deepFill(splitContent(schema, defaultSeed).shared, splitContent(schema, defaults).shared),
  );
  // Localized values: only locales that have seed content (others fall back at read time).
  for (const locale of projectConfig.localeCodes) {
    const localeSeed = seedToStored(schema, seed?.[locale], assetIds);
    const isDefault = locale === projectConfig.defaultLocale;
    if (!localeSeed && !isDefault) continue;
    let localized = splitContent(schema, localeSeed ?? {}).localized;
    if (isDefault) localized = deepFill(localized, splitContent(schema, defaults).localized);
    rows.set(locale, localized);
  }
  return rows;
}

async function readSeedState(
  db: Database,
  scope: string,
  key: string,
): Promise<Map<string, SeedHashes>> {
  const rows = await db
    .select({ locale: contentSeedState.locale, hashes: contentSeedState.hashes })
    .from(contentSeedState)
    .where(and(eq(contentSeedState.scope, scope), eq(contentSeedState.documentKey, key)));
  return new Map(rows.map((row) => [row.locale, row.hashes]));
}

async function writeSeedState(
  db: Database,
  target: SyncTarget,
  locale: string,
  hashes: SeedHashes,
): Promise<void> {
  const values = { scope: target.scope, documentKey: target.key, locale, hashes: { ...hashes } };
  await db
    .insert(contentSeedState)
    .values(values)
    .onConflictDoUpdate({
      target: [contentSeedState.scope, contentSeedState.documentKey, contentSeedState.locale],
      set: { hashes: values.hashes, updatedAt: new Date() },
    });
}

/**
 * Seeds one document's missing rows and fields, moves untouched fields to a
 * changed seed (seed provenance, D-095), records system revisions for those
 * updates and reports orphans.
 */
async function syncDocument(
  db: Database,
  storage: StorageAdapter,
  target: SyncTarget,
  report: SyncReport,
): Promise<void> {
  const { schema, label } = target;
  const assetIds = await importSeedAssets(db, storage, schema, report);
  const rows = await target.store.readRows(db, target.key, projectConfig.localeCodes);
  const applied = await readSeedState(db, target.scope, target.key);
  const context = { userId: null, now: new Date() };
  const updatedRows = new Set<string>();

  for (const [locale, data] of seedRows(schema, assetIds)) {
    const existing = locale === SHARED_LOCALE ? rows.shared : rows.byLocale.get(locale);
    const plan = planSeedRow(schema, existing, data, applied.get(locale));
    const contentChanged = !existing || plan.filled.length > 0 || plan.updated.length > 0;
    if (contentChanged) {
      const version = await target.store.writeContent(
        db,
        target.key,
        locale,
        plan.next,
        existing ? (rows.versions.get(locale) ?? 0) : 0,
        context,
      );
      // Someone saved meanwhile: leave the row (and its provenance) for the next sync.
      if (version === null) continue;
      if (!existing) report.created.push(`${label}:${locale}`);
      report.filled.push(...plan.filled.map((field) => `${label}:${locale}:${field}`));
      report.updated.push(...plan.updated.map((field) => `${label}:${locale}:${field}`));
      if (plan.updated.length > 0) updatedRows.add(locale);
    }
    if (plan.hashesChanged) await writeSeedState(db, target, locale, plan.hashes);
  }
  if (updatedRows.size > 0) await recordCodeUpdate(db, target, rows, updatedRows);

  const current = await target.store.readRows(db, target.key, projectConfig.localeCodes);
  for (const [locale, record] of [
    [SHARED_LOCALE, current.shared] as const,
    ...current.byLocale.entries(),
  ]) {
    for (const orphan of findOrphans(schema, record))
      report.orphans.push(`${label}:${locale}:${orphan}`);
  }
}

/**
 * System revisions for an update from code, so it can be undone from the
 * revision history: the state before (only when the document has no revision
 * yet, i.e. nobody ever saved it) and the state after. A `_shared` update is
 * recorded in the main language's history (shared values belong to every
 * language).
 */
async function recordCodeUpdate(
  db: Database,
  target: SyncTarget,
  before: Awaited<ReturnType<DocumentStore['readRows']>>,
  updatedRows: ReadonlySet<string>,
): Promise<void> {
  const after = await target.store.readRows(db, target.key, projectConfig.localeCodes);
  const locales = new Set(
    [...updatedRows].map((locale) =>
      locale === SHARED_LOCALE ? projectConfig.defaultLocale : locale,
    ),
  );
  // Explicit times: the "before" revision must sort before the update in the history.
  const now = Date.now();
  for (const locale of locales) {
    const seo = { ...parsePageSeo((await target.store.readSeo(db, target.key, locale))?.data) };
    const history = await target.store.listRevisions(db, target.key, locale);
    if (history.length === 0) {
      await target.store.addRevision(
        db,
        target.key,
        locale,
        { content: before.byLocale.get(locale) ?? {}, shared: before.shared ?? {}, seo },
        { id: null, name: BEFORE_CODE_UPDATE_AUTHOR },
        new Date(now - 1000),
      );
    }
    await target.store.addRevision(
      db,
      target.key,
      locale,
      { content: after.byLocale.get(locale) ?? {}, shared: after.shared ?? {}, seo },
      { id: null, name: CODE_UPDATE_AUTHOR },
      new Date(now),
    );
    await target.store.pruneRevisions(db, target.key, locale, MAX_REVISIONS);
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

/** Longest edge of seed images after import. */
export const SEED_IMAGE_MAX_DIMENSION = 2400;

/**
 * Imports seed images once, and again when a seed file changed (its SHA-256
 * differs from the one recorded at import). The old image stays in the library
 * (edited content may still use it); untouched fields move to the new one
 * through seed provenance. Returns seed asset name → media id.
 */
export async function importSeedAssets(
  db: Database,
  storage: StorageAdapter,
  page: ContentSchema,
  report: Pick<SyncReport, 'assetsImported'>,
): Promise<Map<string, string>> {
  const assets = seedAssets(page);
  const ids = new Map<string, string>();
  if (assets.length === 0) return ids;
  const existing = new Map(
    (
      await db
        .select({ id: media.id, seedAsset: media.seedAsset, hash: media.seedAssetHash })
        .from(media)
        .where(inArray(media.seedAsset, assets))
    ).map((row) => [row.seedAsset, row]),
  );
  for (const asset of assets) {
    const bytes = new Uint8Array(
      await fs.readFile(path.join(SEED_ASSETS_DIR, path.basename(asset))),
    );
    const hash = createHash('sha256').update(bytes).digest('hex');
    const row = existing.get(asset);
    if (row && (row.hash === hash || row.hash === null)) {
      // Imported before seed hashes were recorded: remember the hash, change nothing.
      if (row.hash === null)
        await db.update(media).set({ seedAssetHash: hash }).where(eq(media.id, row.id));
      ids.set(asset, row.id);
      continue;
    }
    // A changed seed file: the old image keeps its place in the library, without the seed name.
    if (row) await db.update(media).set({ seedAsset: null }).where(eq(media.id, row.id));
    const imported = await ingestImage(db, storage, {
      bytes,
      originalName: asset,
      uploadedBy: null,
      seedAsset: asset,
      seedAssetHash: hash,
      // Big seed photos make the image optimizer's first requests slow; 2400 px is plenty.
      maxDimension: SEED_IMAGE_MAX_DIMENSION,
    });
    ids.set(asset, imported.id);
    report.assetsImported.push(row ? `${asset} (changed)` : asset);
  }
  return ids;
}
