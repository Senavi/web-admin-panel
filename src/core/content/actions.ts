'use server';

import { eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { z } from 'zod';

import { registry } from '@/content';
import { ActionErrorCode, fail, ok, type ActionResult } from '@/core/actions/result';
import { GuardError, runAction } from '@/core/actions/run';
import { Permission } from '@/core/auth/permissions';
import { assertPermission } from '@/core/auth/server/session';
import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';
import { pageRevisions, type RevisionSnapshot } from '@/core/db/schema';
import { loadMedia } from '@/core/media/resolve';
import { AuditAction, writeAudit } from '@/core/security/audit';
import { pageSeoSchema, parsePageSeo, type PageSeo } from '@/core/seo/page-seo';
import { readSiteSettings } from '@/core/settings/repository';

import type { EditorVersions, MediaPreview, RevisionSummary } from './editor-types';
import { listRevisions } from './editor';
import { savePageContent, type SaveResult } from './save';
import { pageContentSchema } from './validation';
import { collectMediaIds, type ContentRecord, mergeWithoutFallback } from './values';

const versionsSchema = z.object({
  shared: z.number().int().min(0),
  localized: z.number().int().min(0),
  seo: z.number().int().min(0),
});

const saveInputSchema = z.object({
  pageId: z.string().min(1).max(64),
  locale: z.string().min(2).max(16),
  content: z.unknown(),
  seo: z.unknown(),
  versions: versionsSchema,
});

async function resolveTarget(pageId: string, locale: string) {
  const page = registry.byId(pageId);
  if (!page) throw new GuardError('Unknown page.', ActionErrorCode.NotFound);
  const { general } = await readSiteSettings(await getDb());
  if (!general.enabledLocales.includes(locale))
    throw new GuardError('This language is not enabled.', ActionErrorCode.Validation);
  return page;
}

function invalidate(pageId: string, locale: string, result: SaveResult): void {
  if (result.changed.shared) updateTag(CacheTag.content(pageId));
  if (result.changed.localized || result.changed.seo)
    updateTag(CacheTag.contentLocale(pageId, locale));
  if (result.changed.seo) updateTag(CacheTag.Sitemap);
}

/** Saves content + SEO of one page in one locale. */
export async function savePageAction(
  input: unknown,
): Promise<ActionResult<{ versions: EditorVersions }>> {
  return runAction(async () => {
    const user = await assertPermission(Permission.PagesEdit);
    const data = saveInputSchema.parse(input);
    const page = await resolveTarget(data.pageId, data.locale);

    const contentResult = pageContentSchema(page).safeParse(data.content);
    const seoResult = pageSeoSchema.safeParse(data.seo);
    if (!contentResult.success || !seoResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of contentResult.error?.issues ?? [])
        (fieldErrors[`content.${issue.path.join('.')}`] ??= []).push(issue.message);
      for (const issue of seoResult.error?.issues ?? [])
        (fieldErrors[`seo.${issue.path.join('.')}`] ??= []).push(issue.message);
      return fail('Please fix the highlighted fields.', ActionErrorCode.Validation, fieldErrors);
    }

    const db = await getDb();
    const result = await savePageContent(db, {
      pageId: page.id,
      locale: data.locale,
      content: contentResult.data as ContentRecord,
      seo: seoResult.data,
      versions: data.versions,
      author: { id: user.id, name: user.name },
    });
    if (!result.changed.shared && !result.changed.localized && !result.changed.seo) {
      return ok({ versions: result.versions }, 'No changes to save.');
    }
    await writeAudit(db, {
      action: AuditAction.ContentSave,
      actor: { id: user.id, email: user.email },
      target: `page:${page.id}:${data.locale}`,
      summary: { ...result.changed },
    });
    invalidate(page.id, data.locale, result);
    return ok({ versions: result.versions }, 'Saved. The live page updates in a few seconds.');
  });
}

export async function listRevisionsAction(
  input: unknown,
): Promise<ActionResult<RevisionSummary[]>> {
  return runAction(async () => {
    await assertPermission(Permission.PagesView);
    const { pageId, locale } = z
      .object({ pageId: z.string().max(64), locale: z.string().max(16) })
      .parse(input);
    return ok(await listRevisions(await getDb(), pageId, locale));
  });
}

export interface RevisionPreview {
  readonly content: ContentRecord;
  readonly seo: PageSeo;
  /** Previews of images referenced by the revision. */
  readonly media: Readonly<Record<string, MediaPreview>>;
}

async function loadRevision(revisionId: string) {
  const db = await getDb();
  const [revision] = await db.select().from(pageRevisions).where(eq(pageRevisions.id, revisionId));
  if (!revision) throw new GuardError('Revision not found.', ActionErrorCode.NotFound);
  const page = registry.byId(revision.pageId);
  if (!page) throw new GuardError('Unknown page.', ActionErrorCode.NotFound);
  const snapshot = revision.snapshot as RevisionSnapshot;
  const content = mergeWithoutFallback(page, {
    shared: snapshot.shared as ContentRecord,
    localized: snapshot.content as ContentRecord,
  });
  return { db, revision, page, content, seo: parsePageSeo(snapshot.seo) };
}

export async function getRevisionAction(input: unknown): Promise<ActionResult<RevisionPreview>> {
  return runAction(async () => {
    await assertPermission(Permission.PagesView);
    const { revisionId } = z.object({ revisionId: z.uuid() }).parse(input);
    const { db, page, content, seo } = await loadRevision(revisionId);
    const info = await loadMedia(db, [
      ...collectMediaIds(page, content),
      ...(seo.ogImageId ? [seo.ogImageId] : []),
    ]);
    const media: Record<string, MediaPreview> = {};
    for (const [id, item] of info)
      media[id] = { id, src: item.src, width: item.width, height: item.height };
    return ok({ content, seo, media });
  });
}

/** Restores a revision as a new save (it becomes the latest revision; history is kept). */
export async function restoreRevisionAction(
  input: unknown,
): Promise<ActionResult<{ versions: EditorVersions }>> {
  return runAction(async () => {
    const user = await assertPermission(Permission.PagesEdit);
    const { revisionId, versions } = z
      .object({ revisionId: z.uuid(), versions: versionsSchema })
      .parse(input);
    const { db, revision, page, content, seo } = await loadRevision(revisionId);
    await resolveTarget(page.id, revision.locale);
    const result = await savePageContent(db, {
      pageId: page.id,
      locale: revision.locale,
      content,
      seo,
      versions,
      author: { id: user.id, name: user.name },
    });
    await writeAudit(db, {
      action: AuditAction.ContentRestore,
      actor: { id: user.id, email: user.email },
      target: `page:${page.id}:${revision.locale}`,
      summary: { revisionId },
    });
    invalidate(page.id, revision.locale, result);
    return ok({ versions: result.versions }, 'Revision restored.');
  });
}
