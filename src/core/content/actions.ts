'use server';

import { updateTag } from 'next/cache';

import { feedsSiteState, markSiteStateChanged } from '@/core/site-gate/state-version';
import { z } from 'zod';

import { ActionErrorCode, fail, ok, type ActionResult } from '@/core/actions/result';
import { GuardError, runAction } from '@/core/actions/run';
import { Permission } from '@/core/auth/permissions';
import { assertPermission } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import type { Database } from '@/core/db/types';
import { loadMedia, seedAssetIds } from '@/core/media/resolve';
import { AuditAction, writeAudit } from '@/core/security/audit';
import { parsePageSeo, type PageSeo } from '@/core/seo/page-seo';

/** SEO of documents without SEO (shared sections). */
const DEFAULT_SEO: PageSeo = parsePageSeo(undefined);
import { readSiteSettings } from '@/core/settings/repository';

import { type ContentDocument, resolveDocument } from './document';
import { documentTargetSchema } from './document-target';
import type {
  CodeDefaultsChange,
  EditorVersions,
  MediaPreview,
  RevisionSummary,
} from './editor-types';
import { loadValues } from './editor';
import { changedFields, codeDefaultContent } from './seed-provenance';
import { DocumentKind } from './document-target';
import { assertDocumentMedia, saveDocument, saveDocumentIn, type SaveResult } from './save';
import { sharedUses } from './shared-section';
import { validateDocumentInput } from './document-validation';
import {
  collectMediaIds,
  type ContentRecord,
  mergeWithoutFallback,
  seedAssets,
  seedToStored,
} from './values';
import { selectedLocales } from '@/core/i18n/language-state';
import { contentRegistry } from './project-registry';

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
  /** Shared sections edited on this page (saved with it, in the same transaction). */
  shared: z
    .array(z.object({ id: z.string().min(1).max(64), versions: versionsSchema }))
    .max(50)
    .default([]),
});

interface SharedSave {
  readonly document: ContentDocument;
  readonly label: string;
  readonly content: ContentRecord;
  readonly versions: EditorVersions;
}

/** Conflict on a shared section edited from a page: name the section. */
function sharedConflict(label: string): GuardError {
  return new GuardError(
    `Someone else saved the shared section “${label}” since you opened this page. Reload to see their changes (your edits will be lost), or copy them first.`,
    ActionErrorCode.Conflict,
  );
}

/** Resolves the document and checks the locale is enabled. */
async function resolveTarget(db: Database, input: unknown, locale: string) {
  const document = await resolveDocument(documentTargetSchema.parse(input));
  if (!document) throw new GuardError('This item no longer exists.', ActionErrorCode.NotFound);
  const { general } = await readSiteSettings(db);
  if (!selectedLocales(general).includes(locale))
    throw new GuardError('This language is not enabled.', ActionErrorCode.Validation);
  return document;
}

async function invalidate(
  document: ContentDocument,
  locale: string,
  result: SaveResult,
): Promise<void> {
  const tags = document.tagsToInvalidate(locale, result.changed);
  for (const tag of tags) updateTag(tag);
  if (tags.some(feedsSiteState)) await markSiteStateChanged();
}

/** Saves content (+ SEO when the document has it) of one document in one locale. */
export async function saveDocumentAction(
  input: unknown,
): Promise<
  ActionResult<{ versions: EditorVersions; sharedVersions: Record<string, EditorVersions> }>
> {
  return runAction(async () => {
    const user = await assertPermission(Permission.PagesEdit);
    const data = saveInputSchema.parse(input);
    const db = await getDb();
    const document = await resolveTarget(db, data.target, data.locale);

    const validated = validateDocumentInput(document, data.content, data.seo);
    // Shared sections edited here: only those this page actually places.
    const placed = new Set(
      sharedUses({ sections: document.displaySections ?? [] }).map((use) => use.sharedId),
    );
    const sharedSaves: SharedSave[] = [];
    const fieldErrors = 'fieldErrors' in validated ? { ...validated.fieldErrors } : {};
    for (const edit of data.shared) {
      if (!placed.has(edit.id))
        throw new GuardError('Unknown shared section.', ActionErrorCode.Validation);
      const sharedDocument = await resolveDocument({ kind: DocumentKind.Shared, id: edit.id });
      if (!sharedDocument)
        throw new GuardError('Unknown shared section.', ActionErrorCode.NotFound);
      // Field errors keep the page's paths (`content.<section>.<field>`).
      const result = validateDocumentInput(sharedDocument, data.content, undefined);
      if ('fieldErrors' in result) Object.assign(fieldErrors, result.fieldErrors);
      else
        sharedSaves.push({
          document: sharedDocument,
          label: sharedDocument.label,
          content: result.data.content,
          versions: edit.versions,
        });
    }
    if ('fieldErrors' in validated || Object.keys(fieldErrors).length > 0) {
      return fail('Please fix the highlighted fields.', ActionErrorCode.Validation, fieldErrors);
    }

    const author = { id: user.id, name: user.name };
    const pageInput = {
      locale: data.locale,
      ...validated.data,
      versions: data.versions,
      author,
    };
    await assertDocumentMedia(db, document, pageInput);
    for (const save of sharedSaves)
      await assertDocumentMedia(db, save.document, { content: save.content, seo: DEFAULT_SEO });
    const { result, sharedResults } = await db.transaction(async (tx) => {
      const pageResult = await saveDocumentIn(tx, document, pageInput);
      const saved: Array<{ save: SharedSave; result: SaveResult }> = [];
      for (const save of sharedSaves) {
        try {
          const sharedResult = await saveDocumentIn(tx, save.document, {
            locale: data.locale,
            content: save.content,
            seo: DEFAULT_SEO,
            versions: save.versions,
            author,
          });
          saved.push({ save, result: sharedResult });
        } catch (error) {
          if (error instanceof GuardError && error.code === ActionErrorCode.Conflict)
            throw sharedConflict(save.label);
          throw error;
        }
      }
      return { result: pageResult, sharedResults: saved };
    });

    const changedAny = (changed: SaveResult['changed']) =>
      changed.shared || changed.localized || changed.seo;
    const sharedVersions = Object.fromEntries(
      sharedResults.map(({ save, result: sharedResult }) => [
        save.document.target.kind === DocumentKind.Shared ? save.document.target.id : '',
        sharedResult.versions,
      ]),
    );
    if (
      !changedAny(result.changed) &&
      !sharedResults.some(({ result: r }) => changedAny(r.changed))
    ) {
      return ok({ versions: result.versions, sharedVersions }, 'No changes to save.');
    }
    const actor = { id: user.id, email: user.email };
    if (changedAny(result.changed)) {
      await writeAudit(db, {
        action: AuditAction.ContentSave,
        actor,
        target: document.auditTarget(data.locale),
        summary: { ...result.changed },
      });
      await invalidate(document, data.locale, result);
    }
    for (const { save, result: sharedResult } of sharedResults) {
      if (!changedAny(sharedResult.changed)) continue;
      await writeAudit(db, {
        action: AuditAction.ContentSave,
        actor,
        target: save.document.auditTarget(data.locale),
        summary: { ...sharedResult.changed, from: document.auditTarget(data.locale) },
      });
      await invalidate(save.document, data.locale, sharedResult);
    }
    return ok(
      { versions: result.versions, sharedVersions },
      'Saved. The live site updates in a few seconds.',
    );
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
    await invalidate(document, revision.locale, result);
    return ok({ versions: result.versions }, 'Revision restored.');
  });
}

const resetInputSchema = z.object({
  target: documentTargetSchema,
  locale: localeSchema,
  /** One section (the document's own, or a shared section placed on the page); omitted: all own sections. */
  sectionId: z.string().min(1).max(64).optional(),
});

export interface CodeDefaultsPreview {
  readonly changes: readonly CodeDefaultsChange[];
  /** Set when the section is a shared section: the reset changes it on every page that uses it. */
  readonly shared: { readonly id: string; readonly label: string; readonly pages: number } | null;
}

/**
 * What a reset works on: the document (a shared section placed on a page is
 * reset in its own document), the sections, the editor's current values and
 * the code defaults (seed for the locale → main language seed → field defaults).
 */
async function resetScope(db: Database, input: z.infer<typeof resetInputSchema>) {
  const owner = await resolveTarget(db, input.target, input.locale);
  let document = owner;
  let shared: CodeDefaultsPreview['shared'] = null;
  if (input.sectionId) {
    const placed = sharedUses({ sections: owner.displaySections ?? [] }).find(
      (use) => use.id === input.sectionId,
    );
    if (placed) {
      const sharedDocument = await resolveDocument({
        kind: DocumentKind.Shared,
        id: placed.sharedId,
      });
      if (!sharedDocument) throw new GuardError('Unknown section.', ActionErrorCode.NotFound);
      document = sharedDocument;
      shared = {
        id: placed.sharedId,
        label: sharedDocument.label,
        pages: contentRegistry.pagesUsingShared(placed.sharedId).length,
      };
    } else if (!owner.schema.sections.some((section) => section.id === input.sectionId)) {
      throw new GuardError('Unknown section.', ActionErrorCode.Validation);
    }
  }
  const codeSchema = document.codeSchema;
  if (!codeSchema)
    throw new GuardError('This item has no code defaults.', ActionErrorCode.Validation);
  const { general } = await readSiteSettings(db);
  const mainLocale = general.defaultLocale;
  const [current, assetIds] = await Promise.all([
    loadValues(db, document.schema, document.store, document.key, input.locale, mainLocale),
    seedAssetIds(db, seedAssets(codeSchema)),
  ]);
  const seed = codeSchema.seed as Partial<Record<string, ContentRecord>> | undefined;
  const defaults = codeDefaultContent(document.schema, [
    seedToStored(codeSchema, seed?.[input.locale], assetIds),
    seedToStored(codeSchema, seed?.[mainLocale], assetIds),
  ]);
  const sections = input.sectionId ? new Set([input.sectionId]) : undefined;
  const changes = changedFields(document.schema, current.content, defaults, sections).map(
    ({ sectionId, key }) => {
      const section = document.schema.sections.find((entry) => entry.id === sectionId);
      return { section: section?.label ?? sectionId, field: section?.fields[key]?.label ?? key };
    },
  );
  return { document, current, defaults, sections, changes, shared };
}

/** Fields a "Reset to code defaults" would change (for the confirmation). */
export async function previewCodeDefaultsAction(
  input: unknown,
): Promise<ActionResult<CodeDefaultsPreview>> {
  return runAction(async () => {
    await assertPermission(Permission.PagesEdit);
    const db = await getDb();
    const { changes, shared } = await resetScope(db, resetInputSchema.parse(input));
    return ok({ changes, shared });
  });
}

/**
 * Resets one language of a document (or one section) to the code defaults as
 * a normal save: a revision (restorable), conflict detection, audit entry and
 * cache invalidation. SEO is not touched.
 */
export async function resetToCodeDefaultsAction(input: unknown): Promise<
  ActionResult<{
    versions: EditorVersions;
    /** Values of the reset sections, to put into the editor. */
    content: ContentRecord;
    /** Set when a shared section was reset (its versions are in `versions`). */
    sharedId: string | null;
  }>
> {
  return runAction(async () => {
    const user = await assertPermission(Permission.PagesEdit);
    const data = resetInputSchema.extend({ versions: versionsSchema }).parse(input);
    const db = await getDb();
    const { document, current, defaults, sections, changes, shared } = await resetScope(db, data);
    const reset: ContentRecord = {};
    for (const section of document.schema.sections) {
      if (!sections || sections.has(section.id)) reset[section.id] = defaults[section.id] ?? {};
    }
    if (changes.length === 0)
      return ok(
        { versions: data.versions, content: reset, sharedId: shared?.id ?? null },
        'Already the same as the code defaults.',
      );
    const storedSeo = document.hasSeo
      ? await document.store.readSeo(db, document.key, data.locale)
      : null;
    const result = await saveDocument(db, document, {
      locale: data.locale,
      content: { ...current.content, ...reset },
      seo: document.hasSeo ? parsePageSeo(storedSeo?.data) : DEFAULT_SEO,
      versions: data.versions,
      author: { id: user.id, name: user.name },
    });
    await writeAudit(db, {
      action: AuditAction.ContentReset,
      actor: { id: user.id, email: user.email },
      target: document.auditTarget(data.locale),
      summary: { fields: changes.length, section: data.sectionId ?? 'all' },
    });
    await invalidate(document, data.locale, result);
    return ok(
      { versions: result.versions, content: reset, sharedId: shared?.id ?? null },
      'Reset to the code defaults. You can undo it from the history.',
    );
  });
}
