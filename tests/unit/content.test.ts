import { describe, expect, expectTypeOf, it } from 'vitest';

import { registry } from '@/content';
import { type homePage } from '@/content/pages/home';
import {
  definePage,
  defineSection,
  type ResolvedImage,
  type ResolvedPageContent,
} from '@/core/content/define';
import { f } from '@/core/content/fields';
import { createRegistry } from '@/core/content/registry';
import { checkRoutes } from '@/core/content/route-check';
import { richTextFromParagraphs } from '@/core/content/rich-text';
import { pageContentSchema } from '@/core/content/validation';
import {
  findOrphans,
  mergeWithoutFallback,
  resolveWithFallback,
  seedAssets,
  seedToStored,
  splitContent,
  type ContentRecord,
} from '@/core/content/values';

const testPage = definePage({
  id: 'test',
  path: '/test',
  label: 'Test',
  parent: null,
  seo: { title: 'Test' },
  sections: [
    defineSection({
      id: 'main',
      label: 'Main',
      fields: {
        title: f.text({ required: true, max: 10 }),
        logo: f.image({ localized: false }),
        count: f.number({ localized: false, min: 1, integer: true }),
        tone: f.select({
          options: [
            { value: 'calm', label: 'Calm' },
            { value: 'loud', label: 'Loud' },
          ],
        }),
        items: f.list({ min: 1, of: { label: f.text({ required: true }) } }),
      },
    }),
  ],
  seed: {
    en: { main: { title: 'Seed EN', items: [{ label: 'One' }] } },
  },
});

describe('content types', () => {
  it('infers resolved content from the schema', () => {
    type Home = ResolvedPageContent<typeof homePage.sections>;
    expectTypeOf<Home['hero']['title']>().toEqualTypeOf<string>();
    expectTypeOf<Home['hero']['image']>().toEqualTypeOf<ResolvedImage | null>();
    expectTypeOf<Home['features']['items'][number]['icon']>().toEqualTypeOf<
      'layout' | 'shield' | 'globe' | 'chart' | 'zap' | 'image'
    >();
    expectTypeOf<Home['stats']['items'][number]['value']>().toEqualTypeOf<number>();
  });

  it('rejects seeds that do not match the schema (compile time)', () => {
    definePage({
      id: 'x',
      path: '/x',
      label: 'X',
      parent: null,
      seo: { title: 'X' },
      sections: [defineSection({ id: 's', label: 'S', fields: { n: f.number() } })],
      // @ts-expect-error: `n` must be a number
      seed: { en: { s: { n: 'not a number' } } },
    });
  });
});

describe('content validation', () => {
  const schema = pageContentSchema(testPage);
  const valid = {
    main: {
      title: 'Hello',
      logo: { mediaId: null, alt: '' },
      count: 2,
      tone: 'calm',
      items: [{ _key: 'a', label: 'One' }],
    },
  };

  it('accepts valid content', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it('enforces required, max, integer, enum and list minimums', () => {
    const invalid = { main: { ...valid.main, title: '', count: 1.5, tone: 'other', items: [] } };
    const result = schema.safeParse(invalid);
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining(['main.title', 'main.count', 'main.tone', 'main.items']),
    );
    expect(schema.safeParse({ main: { ...valid.main, title: 'x'.repeat(11) } }).success).toBe(
      false,
    );
  });

  it('requires alt text when an image is set', () => {
    const id = '7d7b6a3e-6f53-4c1b-9d9d-2f1f5c0b9a11';
    expect(
      schema.safeParse({ main: { ...valid.main, logo: { mediaId: id, alt: '' } } }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ main: { ...valid.main, logo: { mediaId: id, alt: 'Logo' } } }).success,
    ).toBe(true);
  });

  it('validates every demo page seed against its schema', () => {
    for (const page of registry.pages) {
      const content = resolveWithFallback(page, {
        primary: { shared: undefined, localized: undefined },
        seeds: [
          seedToStored(
            page,
            page.seed?.en as ContentRecord,
            new Map(seedAssets(page).map((a) => [a, crypto.randomUUID()])),
          ),
        ],
      });
      const result = pageContentSchema(page).safeParse(content);
      expect(result.error?.issues ?? [], page.id).toEqual([]);
    }
  });
});

describe('content storage', () => {
  const mediaId = '0b0f7e3c-2d52-4d5e-8f61-1c1f0d1c2a33';
  const content: ContentRecord = {
    main: {
      title: 'Hello',
      logo: { mediaId, alt: 'Alt EN' },
      count: 3,
      tone: 'loud',
      items: [{ _key: 'a', label: 'One' }],
    },
  };

  it('splits shared and localized values (image alt stays localized)', () => {
    const { shared, localized } = splitContent(testPage, content);
    expect(shared).toEqual({ main: { logo: { mediaId }, count: 3 } });
    expect(localized).toEqual({
      main: {
        title: 'Hello',
        logo: { alt: 'Alt EN' },
        tone: 'loud',
        items: [{ _key: 'a', label: 'One' }],
      },
    });
  });

  it('falls back to the default locale, then seed, then field defaults', () => {
    const en = splitContent(testPage, content);
    const ukLocalized: ContentRecord = { main: { title: 'Привіт' } };
    const resolved = resolveWithFallback(testPage, {
      primary: { shared: en.shared, localized: ukLocalized },
      defaultLocale: { shared: en.shared, localized: en.localized },
      seeds: [],
    });
    expect(resolved.main).toMatchObject({
      title: 'Привіт',
      tone: 'loud',
      count: 3,
      logo: { mediaId, alt: 'Alt EN' },
    });

    const fromSeed = resolveWithFallback(testPage, {
      primary: { shared: undefined, localized: undefined },
      seeds: [seedToStored(testPage, testPage.seed?.en as ContentRecord, new Map())],
    });
    expect(fromSeed.main).toMatchObject({ title: 'Seed EN', count: 1, tone: 'calm' });
  });

  it('treats invalid stored values as missing', () => {
    const resolved = mergeWithoutFallback(testPage, {
      shared: { main: { count: 'oops' } },
      localized: { main: { title: 42 } },
    });
    expect(resolved.main).toMatchObject({ title: '', count: 1 });
  });

  it('reports orphaned fields without failing', () => {
    expect(findOrphans(testPage, { main: { title: 'x', removed: 1 }, gone: {} })).toEqual([
      'main.removed',
      'gone',
    ]);
  });

  it('builds rich text from paragraphs', () => {
    expect(richTextFromParagraphs('a', 'b').content).toHaveLength(2);
  });
});

describe('registry', () => {
  it('builds the demo page tree', () => {
    const tree = registry.tree();
    expect(tree.map((node) => node.page.id)).toEqual(['home', 'about', 'contact']);
    expect(tree.find((node) => node.page.id === 'about')?.children.map((n) => n.page.id)).toEqual([
      'team',
    ]);
  });

  it('rejects duplicate ids, unknown parents and cycles', () => {
    const page = (id: string, parent: string | null, path: `/${string}` = `/${id}`) =>
      definePage({ id, path, label: id, parent, seo: { title: id }, sections: [] });
    expect(() => createRegistry([page('a', null), page('a', null, '/b')])).toThrow(
      /Duplicate page id/,
    );
    expect(() => createRegistry([page('a', 'missing')])).toThrow(/unknown parent/);
    expect(() => createRegistry([page('a', 'b'), page('b', 'a')])).toThrow(/cycle/);
  });
});

describe('content:check', () => {
  const pages = [
    { id: 'home', path: '/' },
    { id: 'team', path: '/about/team' },
  ];
  const route = (file: string, id: string | null) => ({
    file,
    source: id
      ? `export default createPageRoute('${id}', View).Page;`
      : 'export default function X() {}',
  });

  it('passes when every page has one matching route', () => {
    expect(
      checkRoutes(pages, [
        route('[locale]/page.tsx', 'home'),
        route('[locale]/about/(x)/team/page.tsx', 'team'),
      ]),
    ).toEqual([]);
  });

  it('reports missing routes, unregistered pages, path mismatches and unmanaged routes', () => {
    const problems = checkRoutes(pages, [
      route('[locale]/page.tsx', 'home'),
      route('[locale]/team/page.tsx', 'team'),
      route('[locale]/blog/page.tsx', 'blog'),
      route('[locale]/legal/page.tsx', null),
    ]);
    expect(problems.join('\n')).toMatch(/route is "\/team"/);
    expect(problems.join('\n')).toMatch(/"blog" is not registered/);
    expect(problems.join('\n')).toMatch(/legal\/page.tsx: renders a site route/);
  });

  it('honors the ignore marker', () => {
    const ignored = {
      file: '[locale]/legal/page.tsx',
      source: '// content-check: ignore\nexport default 1',
    };
    expect(
      checkRoutes([{ id: 'home', path: '/' }], [route('[locale]/page.tsx', 'home'), ignored]),
    ).toEqual([]);
  });
});
