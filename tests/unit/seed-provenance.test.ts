import { describe, expect, it } from 'vitest';

import { defineSection } from '@/core/content/define';
import { f } from '@/core/content/fields';
import {
  changedFields,
  codeDefaultContent,
  planSeedRow,
  seedValueHash,
} from '@/core/content/seed-provenance';
import type { ContentRecord } from '@/core/content/values';

const hero = defineSection({
  id: 'hero',
  label: 'Hero',
  fields: {
    title: f.text({ label: 'Title' }),
    body: f.textarea({ label: 'Body' }),
    image: f.image({ label: 'Image' }),
    tags: f.list({ label: 'Tags', of: f.text({ max: 30 }) }),
  },
});
const schema = { sections: [hero] };

const seedV1: ContentRecord = {
  hero: {
    title: 'Hello',
    body: 'First body',
    image: { mediaId: 'asset-1', alt: 'A' },
    tags: [
      { _key: 'k1', value: 'one' },
      { _key: 'k2', value: 'two' },
    ],
  },
};
const seedV2: ContentRecord = {
  hero: {
    title: 'Hello, world',
    body: 'Second body',
    image: { mediaId: 'asset-2', alt: 'A' },
    // Keys are generated per sync: only the values count.
    tags: [
      { _key: 'x1', value: 'one' },
      { _key: 'x2', value: 'three' },
    ],
  },
};

/** What the first sync stores: the row and its hashes. */
function firstSync() {
  const plan = planSeedRow(schema, undefined, seedV1, undefined);
  return { row: plan.next, hashes: plan.hashes };
}

describe('seed provenance', () => {
  it('creates a missing row from the seed and records every field', () => {
    const plan = planSeedRow(schema, undefined, seedV1, undefined);
    expect(plan.next).toEqual(seedV1);
    expect(Object.keys(plan.hashes).sort()).toEqual([
      'hero.body',
      'hero.image',
      'hero.tags',
      'hero.title',
    ]);
    expect(plan.hashesChanged).toBe(true);
  });

  it('moves untouched fields to a changed seed and keeps edited ones', () => {
    const { row, hashes } = firstSync();
    const edited = { hero: { ...row.hero, body: 'Written by the client' } };
    const plan = planSeedRow(schema, edited, seedV2, hashes);
    expect([...plan.updated].sort()).toEqual(['hero.image', 'hero.tags', 'hero.title']);
    expect(plan.next.hero?.title).toBe('Hello, world');
    expect(plan.next.hero?.body).toBe('Written by the client');
    // A replaced seed image (new asset) reaches fields still showing the old one.
    expect(plan.next.hero?.image).toEqual({ mediaId: 'asset-2', alt: 'A' });
    // The newest seed is remembered, so the edited field stays edited later too.
    expect(plan.hashes['hero.body']).toBe(seedValueHash(hero.fields.body, 'Second body'));
  });

  it('changes nothing when the seed did not change, even with new list keys', () => {
    const { row, hashes } = firstSync();
    const sameSeedNewKeys: ContentRecord = {
      hero: {
        ...seedV1.hero,
        tags: [
          { _key: 'z1', value: 'one' },
          { _key: 'z2', value: 'two' },
        ],
      },
    };
    const plan = planSeedRow(schema, row, sameSeedNewKeys, hashes);
    expect(plan.updated).toEqual([]);
    expect(plan.filled).toEqual([]);
    expect(plan.hashesChanged).toBe(false);
  });

  it('first sync after upgrading records hashes and changes nothing', () => {
    // A row filled by an older version (no provenance), now with an older seed text.
    const legacy = { hero: { ...seedV1.hero } };
    const plan = planSeedRow(schema, legacy, seedV2, undefined);
    expect(plan.updated).toEqual([]);
    expect(plan.next).toEqual(legacy);
    expect(plan.hashesChanged).toBe(true);
    // The next seed change no longer touches it (the value wasn't the recorded seed).
    const seedV3 = { hero: { ...seedV2.hero, title: 'Third' } };
    expect(planSeedRow(schema, legacy, seedV3, plan.hashes).updated).toEqual([]);
  });

  it('fills missing fields without touching the others', () => {
    const { row, hashes } = firstSync();
    const partial = { hero: { title: row.hero?.title } };
    const plan = planSeedRow(schema, partial, seedV1, hashes);
    expect([...plan.filled].sort()).toEqual(['hero.body', 'hero.image', 'hero.tags']);
    expect(plan.updated).toEqual([]);
  });

  it('keeps languages apart: each row has its own hashes', () => {
    const en = planSeedRow(schema, undefined, seedV1, undefined);
    const ukSeed = { hero: { title: 'Привіт' } };
    const uk = planSeedRow(schema, undefined, ukSeed, undefined);
    // The English seed changes; the Ukrainian row (own seed, own hashes) is untouched.
    const enNext = planSeedRow(schema, en.next, seedV2, en.hashes);
    const ukNext = planSeedRow(schema, uk.next, ukSeed, uk.hashes);
    expect(enNext.updated).toContain('hero.title');
    expect(ukNext.updated).toEqual([]);
    expect(ukNext.next.hero?.title).toBe('Привіт');
    // An edited Ukrainian title survives a Ukrainian seed change.
    const ukEdited = { hero: { title: 'Вітаємо' } };
    expect(
      planSeedRow(schema, ukEdited, { hero: { title: 'Привіт!' } }, uk.hashes).updated,
    ).toEqual([]);
  });

  it('ignores normalization by the editor (a save without changes is not an edit)', () => {
    const { row, hashes } = firstSync();
    // The editor saves list items with fresh keys and the same values.
    const saved = {
      hero: {
        ...row.hero,
        tags: [
          { _key: 'saved-1', value: 'one' },
          { _key: 'saved-2', value: 'two' },
        ],
      },
    };
    expect(planSeedRow(schema, saved, seedV2, hashes).updated).toContain('hero.tags');
  });
});

describe('code defaults', () => {
  it('takes the locale seed, then the main language seed, then field defaults', () => {
    const defaults = codeDefaultContent(schema, [{ hero: { title: 'Привіт' } }, seedV1]);
    expect(defaults.hero?.title).toBe('Привіт');
    expect(defaults.hero?.body).toBe('First body');
    const empty = codeDefaultContent(schema, [undefined]);
    expect(empty.hero?.title).toBe('');
  });

  it('lists the fields a reset would change, optionally for one section', () => {
    const current = { hero: { ...seedV1.hero, title: 'Edited' } };
    expect(changedFields(schema, current, seedV1)).toEqual([{ sectionId: 'hero', key: 'title' }]);
    expect(changedFields(schema, current, seedV1, new Set(['other']))).toEqual([]);
  });
});
