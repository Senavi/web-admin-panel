'use server';

import { updateTag } from 'next/cache';
import { z } from 'zod';

import { ActionErrorCode, fail, ok, type ActionResult } from '@/core/actions/result';
import { GuardError, runAction } from '@/core/actions/run';
import { Permission } from '@/core/auth/permissions';
import { assertPermission } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import type { Database } from '@/core/db/types';
import { loadMedia } from '@/core/media/resolve';
import { AuditAction, writeAudit } from '@/core/security/audit';
import { parsePageSeo, type PageSeo } from '@/core/seo/page-seo';
import { readSiteSettings } from '@/core/settings/repository';

import { type ContentDocument, resolveDocument } from './document';
import { documentTargetSchema } from './document-target';
import type { EditorVersions, MediaPreview, RevisionSummary } from './editor-types';
import { saveDocument, type SaveResult } from './save';
import { validateDocumentInput } from './document-validation';
import { collectMediaIds, type ContentRecord, mergeWithoutFallback } from './values';

const versionsSchema = z.object({
  shared: z.number().int().min(0),
  localized: z.number().int().min(0),
  seo: z.number().int().min(0),
});

const localeSchema = z.string().min(2).max(16);

const saveInputSchema = z.object({
  target: documentTargetSchema,
  locale: localeSchema,
  content: z.unknown(),
  seo: z.unknown(),
  versions: versionsSchema,
});

/** Resolves the document and checks the locale is enabled. */
async function resolveTarget(db: Database, input: unknown, locale: string) {
  const document = await resolveDocument(documentTargetSchema.parse(input));
  if (!document) throw new GuardError('This item no longer exists.', ActionErrorCode.NotFound);
  const { general } = await readSiteSettings(db);
  if (!general.enabledLocales.includes(locale))
    throw new GuardError('This language is not enabled.', ActionErrorCode.Validation);
  return document;
}

function invalidate(document: ContentDocument, locale: string, result: SaveResult): void {
  for (const tag of document.tagsToInvalidate(locale, result.changed)) updateTag(tag);
}

/** Saves content (+ SEO when the document has it) of one document in one locale. */
export async function saveDocumentAction(
  input: unknown,
): Promise<ActionResult<{ versions: EditorVersions }>> {
  return runAction(async () => {
    const user = await assertPermission(Permission.PagesEdit);
    const data = saveInputSchema.parse(input);
    const db = await getDb();
    const document = await resolveTarget(db, data.target, data.locale);

    const validated = validateDocumentInput(document, data.content, data.seo);
    if ('fieldErrors' in validated) {
      return fail(
        'Please fix the highlighted fields.',
        ActionErrorCode.Validation,
        validated.fieldErrors,
      );
    }

    const result = await saveDocument(db, document, {
      locale: data.locale,
      ...validated.data,
      versions: data.versions,
      author: { id: user.id, name: user.name },
    });
    if (!result.changed.shared && !result.changed.localized && !result.changed.seo) {
      return ok({ versions: result.versions }, 'No changes to save.');
    }
    await writeAudit(db, {
      action: AuditAction.ContentSave,
      actor: { id: user.id, email: user.email },
      target: document.auditTarget(data.locale),
      summary: { ...result.changed },
    });
    invalidate(document, data.locale, result);
    return ok({ versions: result.versions }, 'Saved. The live site updates in a few seconds.');
  });
}

export async function listRevisionsAction(
  input: unknown,
): Promise<ActionResult<RevisionSummary[]>> {
  return runAction(async () => {
    await assertPermission(Permission.PagesView);
    const { target, locale } = z
      .object({ target: documentTargetSchema, locale: localeSchema })
      .parse(input);
    const document = await resolveDocument(target);
    if (!document) throw new GuardError('This item no longer exists.', ActionErrorCode.NotFound);
    return ok(await document.store.listRevisions(await getDb(), document.key, locale));
  });
}

export interface RevisionPreview {
  readonly content: ContentRecord;
  readonly seo: PageSeo;
  /** Previews of images referenced by the revision. */
  readonly media: Readonly<Record<string, MediaPreview>>;
}

const revisionInputSchema = z.object({ target: documentTargetSchema, revisionId: z.uuid() });

/** Loads a revision of the target document (a revision of another document is "not found"). */
async function loadRevision(input: z.infer<typeof revisionInputSchema>) {
  const db = await getDb();
  const document = await resolveDocument(input.target);
  if (!document) throw new GuardError('This item no longer exists.', ActionErrorCode.NotFound);
  const revision = await document.store.readRevision(db, input.revisionId);
  if (!revision || revision.key !== document.key)
    throw new GuardError('Revision not found.', ActionErrorCode.NotFound);
  const content = mergeWithoutFallback(document.schema, {
    shared: revision.snapshot.shared as ContentRecord,
    localized: revision.snapshot.content as ContentRecord,
  });
  return { db, revision, document, content, seo: parsePageSeo(revision.snapshot.seo) };
}

export async function getRevisionAction(input: unknown): Promise<ActionResult<RevisionPreview>> {
  return runAction(async () => {
    await assertPermission(Permission.PagesView);
    const { db, document, content, seo } = await loadRevision(revisionInputSchema.parse(input));
    const info = await loadMedia(db, [
      ...collectMediaIds(document.schema, content),
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
    const { versions, ...rest } = revisionInputSchema
      .extend({ versions: versionsSchema })
      .parse(input);
    const { db, revision, document, content, seo } = await loadRevision(rest);
    await resolveTarget(db, document.target, revision.locale);
    const result = await saveDocument(db, document, {
      locale: revision.locale,
      content,
      seo,
      versions,
      author: { id: user.id, name: user.name },
    });
    await writeAudit(db, {
      action: AuditAction.ContentRestore,
      actor: { id: user.id, email: user.email },
      target: document.auditTarget(revision.locale),
      summary: { revisionId: rest.revisionId },
    });
    invalidate(document, revision.locale, result);
    return ok({ versions: result.versions }, 'Revision restored.');
  });
}
