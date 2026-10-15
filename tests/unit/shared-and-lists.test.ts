import { describe, expect, expectTypeOf, it } from 'vitest';

import type { ResolvedSection, SeedSection } from '@/core/content/define';
import { definePage, defineSection } from '@/core/content/define';
import { f, ListDisplay, listDisplay, SCALAR_ITEM_KEY } from '@/core/content/fields';
import { createRegistry } from '@/core/content/registry';
import {
  defineSharedSection,
  ownSchema,
  sharedKey,
  sharedUses,
  useShared,
} from '@/core/content/shared-section';
import { pageContentSchema } from '@/core/content/validation';
import { resolveImages, resolveWithFallback, seedToStored } from '@/core/content/values';

describe('list display', () => {
  it('is chosen from the item shape', () => {
    expect(listDisplay(f.list({ of: f.text({ max: 30 }) }))).toBe(ListDisplay.Tags);
    expect(listDisplay(f.list({ of: f.select({ options: [{ value: 'a', label: 'A' }] }) }))).toBe(
      ListDisplay.Tags,
    );
    expect(listDisplay(f.list({ of: f.text({ max: 100 }) }))).toBe(ListDisplay.Lines);
    expect(listDisplay(f.list({ of: f.text() }))).toBe(ListDisplay.Lines);
    expect(listDisplay(f.list({ of: { label: f.text({ max: 60 }) } }))).toBe(ListDisplay.Lines);
    expect(
      listDisplay(f.list({ of: { value: f.number(), suffix: f.text(), label: f.text() } })),
    ).toBe(ListDisplay.Rows);
    expect(listDisplay(f.list({ of: { title: f.text(), text: f.textarea() } }))).toBe(
      ListDisplay.Cards,
    );
    expect(listDisplay(f.list({ of: { photo: f.image(), name: f.text() } }))).toBe(
      ListDisplay.Cards,
    );
    expect(
      listDisplay(f.list({ of: { a: f.text(), b: f.text(), c: f.text(), d: f.text() } })),
    ).toBe(ListDisplay.Cards);
  });

  it('respects an explicit display and rejects one that cannot show the items', () => {
    expect(listDisplay(f.list({ of: f.text(), display: 'tags' }))).toBe(ListDisplay.Tags);
    expect(() => f.list({ of: { a: f.text(), b: f.text() }, display: 'tags' })).toThrow(/tags/);
    expect(() => f.list({ of: { body: f.richText() }, display: 'rows' })).toThrow(/rows/);
  });
});

describe('scalar lists', () => {
  const section = defineSection({
    id: 'post',
    label: 'Post',
    fields: { tags: f.list({ of: f.text({ max: 30 }), max: 3 }) },
  });
  const schema = { sections: [section] };

  it('store items with stable keys and give the site plain values', () => {
    const stored = seedToStored(schema, { post: { tags: ['News', 'Launch'] } }, new Map());
    const items = stored?.post?.tags as Array<Record<string, unknown>>;
    expect(items.map((item) => item[SCALAR_ITEM_KEY])).toEqual(['News', 'Launch']);
    expect(items.every((item) => typeof item._key === 'string')).toBe(true);
    const content = resolveWithFallback(schema, {
      primary: { shared: undefined, localized: stored },
      seeds: [],
    });
    expect(resolveImages(schema, content, () => null).post?.tags).toEqual(['News', 'Launch']);
  });

  it('validate min/max and each item', () => {
    const validator = pageContentSchema(schema);
    const item = (value: string) => ({ _key: value.slice(0, 8) || 'k', value });
    expect(validator.safeParse({ post: { tags: [item('a'), item('b')] } }).success).toBe(true);
    expect(
      validator.safeParse({ post: { tags: [item('a'), item('b'), item('c'), item('d')] } }).success,
    ).toBe(false);
    const tooLong = validator.safeParse({ post: { tags: [item('x'.repeat(31))] } });
    expect(tooLong.error?.issues[0]?.path).toEqual(['post', 'tags', 0, 'value']);
  });

  it('type the site value and the seed as plain arrays', () => {
    type Fields = typeof section.fields;
    expectTypeOf<ResolvedSection<Fields>['tags']>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<SeedSection<Fields>['tags']>().toEqualTypeOf<readonly string[] | undefined>();
  });
});

describe('shared sections', () => {
  const cta = defineSharedSection({
    id: 'cta',
    label: 'Call to action',
    fields: { title: f.text({ required: true }) },
    seed: { en: { title: 'Hi' } },
  });
  const hero = defineSection({ id: 'hero', label: 'Hero', fields: { title: f.text() } });
  const home = definePage({
    id: 'home',
    path: '/',
    label: 'Home',
    parent: null,
    seo: { title: 'Home' },
    sections: [hero, useShared(cta)],
    seed: { en: { hero: { title: 'Home' } } },
  });
  const about = definePage({
    id: 'about',
    path: '/about',
    label: 'About',
    parent: null,
    seo: { title: 'About' },
    sections: [useShared(cta)],
  });

  it('keep site order and are stored apart from the page', () => {
    expect(home.sections.map((section) => section.id)).toEqual(['hero', 'cta']);
    expect(sharedUses(home).map((section) => section.sharedId)).toEqual(['cta']);
    expect(ownSchema(home).sections.map((section) => section.id)).toEqual(['hero']);
    expect(sharedKey('cta')).toBe('shared:cta');
    expect(cta.schema.seed).toEqual({ en: { cta: { title: 'Hi' } } });
  });

  it('are typed like any section and excluded from page seeds', () => {
    expectTypeOf<keyof NonNullable<NonNullable<typeof home.seed>['en']>>().toEqualTypeOf<'hero'>();
    expectTypeOf(useShared(cta).id).toEqualTypeOf<'cta'>();
  });

  it('registry: lists the pages using one and rejects unknown ids', () => {
    const registry = createRegistry({ pages: [home, about], sharedSections: [cta] });
    expect(registry.pagesUsingShared('cta').map((page) => page.id)).toEqual(['home', 'about']);
    expect(registry.sharedSectionById('cta')).toBe(cta);
    expect(() => createRegistry({ pages: [home] })).toThrow(/not registered/);
  });
});
