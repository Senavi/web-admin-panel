import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { registry } from '@/content';
import { seedValueHash } from '@/core/content/seed-provenance';
import {
  BEFORE_CODE_UPDATE_AUTHOR,
  CODE_UPDATE_AUTHOR,
  importSeedAssets,
  SeedScope,
  syncContent,
} from '@/core/content/sync';
import type { ContentRecord } from '@/core/content/values';
import { auditLog, contentSeedState, media, pageContent, pageRevisions } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { AuditAction } from '@/core/security/audit';

import { createTestDb } from '../support/db';
import { memoryStorage } from '../support/storage';

const PAGE = 'team';
const page = registry.byId(PAGE);
if (!page) throw new Error('demo page missing');
const intro = page.sections.find((section) => section.id === 'intro');
if (!intro) throw new Error('intro section missing');
const titleField = intro.fields.title;
const leadField = intro.fields.lead;
if (!titleField || !leadField) throw new Error('intro fields missing');

async function row(db: Database, locale: string): Promise<ContentRecord> {
  const [found] = await db
    .select()
    .from(pageContent)
    .where(and(eq(pageContent.pageId, PAGE), eq(pageContent.locale, locale)));
  return found?.data as ContentRecord;
}

/** Pretends the previous seed of `team` (en) had other texts: the title was never edited, the lead was. */
async function simulateOlderSeed(db: Database): Promise<void> {
  const current = await row(db, 'en');
  await db
    .update(pageContent)
    .set({
      data: { ...current, intro: { title: 'Old seed title', lead: 'Written by the client' } },
    })
    .where(and(eq(pageContent.pageId, PAGE), eq(pageContent.locale, 'en')));
  const [state] = await db
    .select()
    .from(contentSeedState)
    .where(
      and(
        eq(contentSeedState.scope, SeedScope.Page),
        eq(contentSeedState.documentKey, PAGE),
        eq(contentSeedState.locale, 'en'),
      ),
    );
  await db
    .update(contentSeedState)
    .set({
      hashes: {
        ...state?.hashes,
        'intro.title': seedValueHash(titleField!, 'Old seed title'),
        'intro.lead': seedValueHash(leadField!, 'Old seed lead'),
      },
    })
    .where(
      and(
        eq(contentSeedState.scope, SeedScope.Page),
        eq(contentSeedState.documentKey, PAGE),
        eq(contentSeedState.locale, 'en'),
      ),
    );
}

describe('content:sync with seed provenance', () => {
  let db: Database;
  let close: () => Promise<void>;
  const storage = memoryStorage();

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
  });
  afterAll(() => close());

  it('first sync creates content and records seed hashes', async () => {
    const report = await syncContent(db, storage);
    expect(report.created).toContain(`${PAGE}:en`);
    expect(report.updated).toEqual([]);
    const states = await db
      .select()
      .from(contentSeedState)
      .where(eq(contentSeedState.documentKey, PAGE));
    expect(states.map((state) => state.locale).sort()).toEqual(['_shared', 'en', 'uk']);
  });

  it('a second sync with the same code changes nothing', async () => {
    const report = await syncContent(db, storage);
    expect(report.created).toEqual([]);
    expect(report.filled).toEqual([]);
    expect(report.updated).toEqual([]);
    expect(report.assetsImported).toEqual([]);
  });

  it('moves never-edited fields to the new seed, keeps edited ones and other languages', async () => {
    const ukBefore = await row(db, 'uk');
    await simulateOlderSeed(db);
    const report = await syncContent(db, storage);
    expect(report.updated).toEqual([`${PAGE}:en:intro.title`]);
    const en = await row(db, 'en');
    expect(en.intro?.title).toBe('Our team');
    expect(en.intro?.lead).toBe('Written by the client');
    expect(await row(db, 'uk')).toEqual(ukBefore);

    // Restorable: the state before and after, as system revisions.
    const revisions = await db
      .select()
      .from(pageRevisions)
      .where(and(eq(pageRevisions.pageId, PAGE), eq(pageRevisions.locale, 'en')));
    expect(revisions.map((revision) => revision.authorName).sort()).toEqual(
      [BEFORE_CODE_UPDATE_AUTHOR, CODE_UPDATE_AUTHOR].sort(),
    );
    const before = revisions.find((revision) => revision.authorName === BEFORE_CODE_UPDATE_AUTHOR);
    expect((before?.snapshot.content as ContentRecord).intro?.title).toBe('Old seed title');
    expect(revisions.every((revision) => revision.authorId === null)).toBe(true);
    const after = revisions.find((revision) => revision.authorName === CODE_UPDATE_AUTHOR);
    expect(before!.createdAt.getTime()).toBeLessThan(after!.createdAt.getTime());

    // One audit entry for the whole sync, no values in it.
    const entries = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, AuditAction.ContentCodeUpdate));
    expect(entries).toHaveLength(1);
    expect(entries[0]?.summary).toEqual({ fields: 1, documents: [PAGE] });
  });

  it('re-imports a changed seed image; the old one stays in the library', async () => {
    const [seeded] = await db.select().from(media).where(eq(media.seedAsset, 'team-1.webp'));
    expect(seeded?.seedAssetHash).toMatch(/^[0-9a-f]{64}$/);
    // Same file name, other bytes: what a teammate replacing the seed image looks like.
    await db
      .update(media)
      .set({ seedAssetHash: 'f'.repeat(64) })
      .where(eq(media.id, seeded!.id));
    const report = { assetsImported: [] as string[] };
    const ids = await importSeedAssets(db, storage, page, report);
    expect(report.assetsImported).toContain('team-1.webp (changed)');
    expect(ids.get('team-1.webp')).not.toBe(seeded!.id);
    const [old] = await db.select().from(media).where(eq(media.id, seeded!.id));
    expect(old?.seedAsset).toBeNull();
  });

  it('untouched images follow the re-imported seed image', async () => {
    const report = await syncContent(db, storage);
    // The people list (photos) and nothing the client edited.
    expect(report.updated).toContain(`${PAGE}:en:members.people`);
    expect(report.updated).not.toContain(`${PAGE}:en:intro.lead`);
  });
});
