import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ActionErrorCode } from '@/core/actions/result';
import { can, Permission } from '@/core/auth/permissions';
import { Role } from '@/core/auth/roles';
import type * as Session from '@/core/auth/server/session';
import type { Database } from '@/core/db/types';

type SessionModule = typeof Session;

import { createTestDb } from '../../support/db';
import { memoryStorage } from '../../support/storage';

/** Who is signed in for the action under test (null = nobody). */
const session = vi.hoisted(() => ({
  role: null as string | null,
  userId: '',
  db: null as unknown,
  requested: [] as string[],
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ updateTag: () => undefined }));
vi.mock('@/core/site-gate/state-version', () => ({
  feedsSiteState: () => false,
  markSiteStateChanged: async () => undefined,
}));
vi.mock('@/core/db/client', () => ({ getDb: async () => session.db }));
vi.mock('@/core/auth/server/session', async (importOriginal) => {
  const original = await importOriginal<SessionModule>();
  return {
    ...original,
    // The real check (role → permission), without a request: the role comes from `session`.
    assertPermission: async (permission: Permission) => {
      session.requested.push(permission);
      const role = session.role as Role | null;
      if (!role || !can(role, permission)) throw new original.AuthorizationError();
      return { id: session.userId, name: 'Editor', email: 'editor@example.com', role };
    },
  };
});

const { previewCodeDefaultsAction, resetToCodeDefaultsAction } =
  await import('@/core/content/actions');
const { syncContent } = await import('@/core/content/sync');
const { DocumentKind } = await import('@/core/content/document-target');
const { createUserWithPassword } = await import('@/core/auth/server/users');
const { auditLog, pageContent } = await import('@/core/db/schema');
const { AuditAction } = await import('@/core/security/audit');

const target = { kind: DocumentKind.Page, id: 'team' };

describe('Reset to code defaults', () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
    session.db = db;
    await syncContent(db, memoryStorage());
    const user = await createUserWithPassword(db, {
      email: 'editor@example.com',
      name: 'Editor',
      role: Role.Manager,
      password: 'Maple-Signal-Harbor-73',
      mustChangePassword: false,
    });
    session.userId = user.id;
  });
  afterAll(() => close());

  async function editTitle(title: string): Promise<void> {
    const where = and(eq(pageContent.pageId, 'team'), eq(pageContent.locale, 'en'));
    const [row] = await db.select().from(pageContent).where(where);
    const data = row!.data as Record<string, Record<string, unknown>>;
    await db
      .update(pageContent)
      .set({ data: { ...data, intro: { ...data.intro, title } }, version: row!.version + 1 })
      .where(where);
  }

  it('requires a signed-in user who may edit content', async () => {
    session.role = null;
    const preview = await previewCodeDefaultsAction({ target, locale: 'en' });
    const reset = await resetToCodeDefaultsAction({
      target,
      locale: 'en',
      versions: { shared: 1, localized: 1, seo: 0 },
    });
    expect(preview.ok).toBe(false);
    expect(reset.ok).toBe(false);
    expect(session.requested).toEqual([Permission.PagesEdit, Permission.PagesEdit]);
  });

  it('lists the fields that will change and resets them as a normal, audited save', async () => {
    session.role = Role.Manager;
    await editTitle('Edited title');
    const preview = await previewCodeDefaultsAction({ target, locale: 'en', sectionId: 'intro' });
    expect(preview.ok && preview.data.changes).toEqual([{ section: 'Intro', field: 'Title' }]);

    const result = await resetToCodeDefaultsAction({
      target,
      locale: 'en',
      sectionId: 'intro',
      versions: { shared: 1, localized: 2, seo: 0 },
    });
    expect(result.ok).toBe(true);
    const [row] = await db
      .select()
      .from(pageContent)
      .where(and(eq(pageContent.pageId, 'team'), eq(pageContent.locale, 'en')));
    expect((row?.data as { intro: { title: string } }).intro.title).toBe('Our team');
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, AuditAction.ContentReset));
    expect(entry?.target).toBe('page:team:en');
  });

  it('detects a conflict like any save', async () => {
    await editTitle('Someone else');
    const result = await resetToCodeDefaultsAction({
      target,
      locale: 'en',
      versions: { shared: 1, localized: 1, seo: 0 },
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.code).toBe(ActionErrorCode.Conflict);
  });

  it('rejects unknown sections', async () => {
    const result = await previewCodeDefaultsAction({ target, locale: 'en', sectionId: 'nope' });
    expect(result.ok).toBe(false);
  });
});
