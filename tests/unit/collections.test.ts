import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { Role } from '@/core/auth/roles';
import { createUserWithPassword } from '@/core/auth/server/users';
import {
  collectionBasePath,
  collectionItemPath,
  defineCollection,
  ITEM_SECTION,
} from '@/core/content/collection';
import { definePage } from '@/core/content/define';
import { f } from '@/core/content/fields';
import { createRegistry } from '@/core/content/registry';
import { saveDocument } from '@/core/content/save';
import { isValidSlug, slugify, uniqueSlug } from '@/core/content/slug';
import { collectionItemStore } from '@/core/content/stores/table-store';
import { decideCollectionRoute } from '@/core/collections/gate';
import { itemMetaSchema } from '@/core/collections/meta';
import { collectionItems } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { DocumentKind } from '@/core/content/document-target';
import { parsePageSeo } from '@/core/seo/page-seo';

import { createTestDb } from '../support/db';

describe('slugs', () => {
  it('transliterates Ukrainian titles and normalizes', () => {
    expect(slugify('Привіт, світе!')).toBe('pryvit-svite');
    expect(slugify('Щедрий вечір — Їжак')).toBe('shchedryi-vechir-izhak');
    expect(slugify('  Hello   World 2026  ')).toBe('hello-world-2026');
    expect(slugify('Café déjà vu')).toBe('cafe-deja-vu');
  });

  it('validates and de-duplicates', () => {
    expect(isValidSlug('hello-world')).toBe(true);
    expect(isValidSlug('Hello')).toBe(false);
    expect(isValidSlug('a--b')).toBe(false);
    expect(isValidSlug('x'.repeat(101))).toBe(false);
    expect(uniqueSlug('post', new Set(['post', 'post-2']))).toBe('post-3');
    expect(uniqueSlug('', new Set())).toBe('item');
  });

  it('item meta schema rejects bad slugs and dates', () => {
    const base = { slug: 'ok', status: 'draft', publishedAt: '', version: 1 };
    expect(itemMetaSchema.safeParse(base).success).toBe(true);
    expect(itemMetaSchema.safeParse({ ...base, slug: 'Not OK' }).success).toBe(false);
    expect(itemMetaSchema.safeParse({ ...base, publishedAt: '2026-13-40' }).success).toBe(false);
  });
});

describe('defineCollection', () => {
  const fields = { title: f.text({ label: 'Title', required: true }) };

  it('applies defaults and builds paths', () => {
    const news = defineCollection({
      id: 'news',
      label: 'News',
      itemLabel: 'Article',
      listPageId: 'news',
      itemPath: '/news/:slug',
      fields,
      titleField: 'title',
    });
    expect(news.pageSize).toBe(12);
    expect(news.sort).toEqual({ by: 'publishedAt', direction: 'desc' });
    expect(news.missingTranslation).toBe('fallback');
    expect(news.schema.sections[0].id).toBe(ITEM_SECTION);
    expect(collectionItemPath(news, 'hi')).toBe('/news/hi');
    expect(collectionBasePath(news)).toBe('/news');
  });

  it('rejects invalid options', () => {
    const base = {
      id: 'news',
      label: 'News',
      itemLabel: 'Article',
      listPageId: 'news',
      itemPath: '/news/:slug',
      fields,
      titleField: 'title',
    } as const;
    expect(() => defineCollection({ ...base, itemPath: '/news/:id' as '/news/:slug' })).toThrow(
      /itemPath/,
    );
    expect(() => defineCollection({ ...base, titleField: 'missing' as 'title' })).toThrow(
      /titleField/,
    );
    expect(() => defineCollection({ ...base, pageSize: 0 })).toThrow(/pageSize/);
  });
});

describe('registry with collections', () => {
  const page = (id: string, path: `/${string}`) =>
    definePage({ id, path, label: id, parent: null, seo: { title: id }, sections: [] });
  const news = defineCollection({
    id: 'news',
    label: 'News',
    itemLabel: 'Article',
    listPageId: 'news',
    itemPath: '/news/:slug',
    fields: { title: f.text({ label: 'Title' }) },
    titleField: 'title',
  });

  it('validates list pages, item paths and conflicts', () => {
    const ok = createRegistry({ pages: [page('news', '/news')], collections: [news] });
    expect(ok.collectionById('news')?.itemLabel).toBe('Article');
    expect(() => createRegistry({ pages: [page('home', '/')], collections: [news] })).toThrow(
      /listPageId/,
    );
    expect(() => createRegistry({ pages: [page('news', '/posts')], collections: [news] })).toThrow(
      /must start with the list page path/,
    );
    expect(() =>
      createRegistry({
        pages: [page('news', '/news'), page('archive', '/news/archive')],
        collections: [news],
      }),
    ).toThrow(/conflicts with collection/);
  });
});

describe('collection item store', () => {
  let db: Database;
  let close: () => Promise<void>;
  let itemId = '';
  let author = { id: '', name: '' };

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
    const user = await createUserWithPassword(db, {
      email: 'items@example.com',
      name: 'Item Editor',
      role: Role.Manager,
      password: 'Maple-Signal-Harbor-73',
      mustChangePassword: false,
    });
    author = { id: user.id, name: user.name };
    const [row] = await db
      .insert(collectionItems)
      .values({ collectionId: 'blog', slug: 'test' })
      .returning({ id: collectionItems.id });
    itemId = row?.id ?? '';
  });
  afterAll(() => close());

  it('saves items with versions and revisions like pages', async () => {
    const blog = defineCollection({
      id: 'blog',
      label: 'Blog',
      itemLabel: 'Post',
      listPageId: 'blog',
      itemPath: '/blog/:slug',
      fields: {
        title: f.text({ label: 'Title', required: true }),
        excerpt: f.textarea(),
        cover: f.image({ localized: false }),
        body: f.richText({ required: true }),
      },
      titleField: 'title',
    });
    const document = {
      target: { kind: DocumentKind.Item, collectionId: 'blog', itemId },
      key: itemId,
      label: 'Test',
      schema: blog.schema,
      store: collectionItemStore,
      hasSeo: true,
      seoDefaults: () => ({ title: '', description: '' }),
      publicPath: () => null,
      auditTarget: () => `item:blog:${itemId}`,
      tagsToInvalidate: () => [],
    };
    const content = {
      [ITEM_SECTION]: {
        title: 'Hello',
        excerpt: '',
        cover: { mediaId: null, alt: '' },
        body: { type: 'doc', content: [] },
      },
    };
    const first = await saveDocument(db, document, {
      locale: 'en',
      content,
      seo: parsePageSeo({}),
      versions: { shared: 0, localized: 0, seo: 0 },
      author,
    });
    expect(first.versions).toEqual({ shared: 1, localized: 1, seo: 0 });
    await expect(
      saveDocument(db, document, {
        locale: 'en',
        content: { [ITEM_SECTION]: { ...content[ITEM_SECTION], title: 'Stale' } },
        seo: parsePageSeo({}),
        versions: { shared: 0, localized: 0, seo: 0 },
        author,
      }),
    ).rejects.toThrow(/Someone else saved/);
    const revisions = await collectionItemStore.listRevisions(db, itemId, 'en');
    expect(revisions).toHaveLength(1);
    const rows = await collectionItemStore.readRows(db, itemId, ['en']);
    expect(rows.byLocale.get('en')?.[ITEM_SECTION]?.title).toBe('Hello');
  });
});

describe('collection gate (proxy)', () => {
  const blogState = {
    itemPath: '/blog/:slug',
    listPath: '/blog',
    pageSize: 2,
    items: { a: ['en', 'uk'], b: ['en', 'uk'], c: ['en'] },
    redirects: { old: 'a', 'old-c': 'c' },
  };
  const decide = (
    path: string,
    locale = 'en',
    pageParam: string | null = null,
    draftMode = false,
  ) =>
    decideCollectionRoute({
      path,
      locale,
      defaultLocale: 'en',
      pageParam,
      draftMode,
      collections: [blogState],
    });

  it('passes published items and 404s unknown, hidden or draft slugs', () => {
    expect(decide('/blog/a')).toEqual({ type: 'pass' });
    expect(decide('/blog/c', 'uk')).toEqual({ type: 'not-found' });
    expect(decide('/blog/nope')).toEqual({ type: 'not-found' });
    expect(decide('/blog/draft', 'en', null, true)).toEqual({ type: 'pass' });
    expect(decide('/about')).toEqual({ type: 'pass' });
  });

  it('redirects old slugs to the localized current URL', () => {
    expect(decide('/blog/old', 'uk')).toEqual({ type: 'redirect', pathname: '/uk/blog/a' });
    expect(decide('/blog/old')).toEqual({ type: 'redirect', pathname: '/blog/a' });
    expect(decide('/blog/old-c', 'uk')).toEqual({ type: 'not-found' });
  });

  it('validates list pages per locale', () => {
    expect(decide('/blog', 'en', '2')).toEqual({ type: 'pass' });
    expect(decide('/blog', 'en', '3')).toEqual({ type: 'not-found' });
    expect(decide('/blog', 'uk', '2')).toEqual({ type: 'not-found' });
    expect(decide('/blog', 'en', 'x')).toEqual({ type: 'not-found' });
    expect(decide('/blog')).toEqual({ type: 'pass' });
  });
});
