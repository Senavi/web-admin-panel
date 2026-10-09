import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { registry } from '@/content';
import { Role } from '@/core/auth/roles';
import { createUserWithPassword } from '@/core/auth/server/users';
import { MAX_REVISIONS, savePageContent } from '@/core/content/save';
import { mergeWithoutFallback, type ContentRecord } from '@/core/content/values';
import { pageContent, pageRevisions, SHARED_LOCALE } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { parsePageSeo } from '@/core/seo/page-seo';

import { createTestDb } from '../support/db';

describe('savePageContent', () => {
  let db: Database;
  let close: () => Promise<void>;
  let author: { id: string; name: string };
  const page = registry.byId('team');
  if (!page) throw new Error('demo page missing');

  const content = (title: string): ContentRecord => {
    const base = mergeWithoutFallback(page, { shared: undefined, localized: undefined });
    return {
      ...base,
      intro: { ...base.intro, title },
      members: { ...base.members, showBios: false },
    };
  };

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
    const user = await createUserWithPassword(db, {
      email: 'editor@example.com',
      name: 'Editor',
      role: Role.Manager,
      password: 'Maple-Signal-Harbor-73',
      mustChangePassword: false,
    });
    author = { id: user.id, name: user.name };
  });
  afterAll(() => close());

  it('creates shared + localized rows on first save and reports changes', async () => {
    const result = await savePageContent(db, {
      pageId: 'team',
      locale: 'en',
      content: content('Hello'),
      seo: parsePageSeo({}),
      versions: { shared: 0, localized: 0, seo: 0 },
      author,
    });
    expect(result.changed).toEqual({ shared: true, localized: true, seo: false });
    expect(result.versions).toEqual({ shared: 1, localized: 1, seo: 0 });
    const [shared] = await db
      .select()
      .from(pageContent)
      .where(and(eq(pageContent.pageId, 'team'), eq(pageContent.locale, SHARED_LOCALE)));
    expect((shared?.data as ContentRecord).members?.showBios).toBe(false);
  });

  it('rejects a save based on an outdated version', async () => {
    await expect(
      savePageContent(db, {
        pageId: 'team',
        locale: 'en',
        content: content('Stale'),
        seo: parsePageSeo({}),
        versions: { shared: 1, localized: 0, seo: 0 },
        author,
      }),
    ).rejects.toThrow(/Someone else saved/);
  });

  it('only bumps rows that changed', async () => {
    const result = await savePageContent(db, {
      pageId: 'team',
      locale: 'en',
      content: content('Hello again'),
      seo: parsePageSeo({}),
      versions: { shared: 1, localized: 1, seo: 0 },
      author,
    });
    expect(result.changed).toEqual({ shared: false, localized: true, seo: false });
    expect(result.versions).toEqual({ shared: 1, localized: 2, seo: 0 });
  });

  it(`keeps only the last ${MAX_REVISIONS} revisions`, async () => {
    let versions = { shared: 1, localized: 2, seo: 0 };
    for (let i = 0; i < MAX_REVISIONS + 3; i += 1) {
      ({ versions } = await savePageContent(db, {
        pageId: 'team',
        locale: 'en',
        content: content(`Title ${i}`),
        seo: parsePageSeo({}),
        versions,
        author,
      }));
    }
    const rows = await db
      .select()
      .from(pageRevisions)
      .where(and(eq(pageRevisions.pageId, 'team'), eq(pageRevisions.locale, 'en')));
    expect(rows).toHaveLength(MAX_REVISIONS);
  });

  it('preserves orphaned keys it does not know', async () => {
    await db
      .insert(pageContent)
      .values({ pageId: 'team', locale: 'uk', data: { intro: { legacyField: 'keep me' } } });
    await savePageContent(db, {
      pageId: 'team',
      locale: 'uk',
      content: content('Привіт'),
      seo: parsePageSeo({}),
      versions: { shared: 1, localized: 1, seo: 0 },
      author,
    });
    const [row] = await db
      .select()
      .from(pageContent)
      .where(and(eq(pageContent.pageId, 'team'), eq(pageContent.locale, 'uk')));
    expect((row?.data as ContentRecord).intro).toMatchObject({
      title: 'Привіт',
      legacyField: 'keep me',
    });
  });
});
