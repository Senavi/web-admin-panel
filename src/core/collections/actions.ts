'use server';

import { and, eq, sql } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { z } from 'zod';

import { ActionErrorCode, fail, ok, type ActionResult } from '@/core/actions/result';
import { GuardError, runAction } from '@/core/actions/run';
import { Permission } from '@/core/auth/permissions';
import { assertPermission } from '@/core/auth/server/session';
import { CacheTag } from '@/core/cache/tags';
import { type AnyCollection, CollectionItemStatus, ITEM_SECTION } from '@/core/content/collection';
import { resolveDocument } from '@/core/content/document';
import { DocumentKind } from '@/core/content/document-target';
import { validateDocumentInput } from '@/core/content/document-validation';
import type { EditorVersions } from '@/core/content/editor-types';
import { contentRegistry } from '@/core/content/project-registry';
import { saveDocument } from '@/core/content/save';
import { isValidSlug, slugify, uniqueSlug } from '@/core/content/slug';
import { getDb } from '@/core/db/client';
import { collectionItems, collectionSlugRedirects } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { AuditAction, writeAudit } from '@/core/security/audit';
import { readSiteSettings } from '@/core/settings/repository';

import { takenSlugs } from './admin';
import { type ItemMeta, itemMetaSchema, toDateInput } from './meta';
import { findItem } from './repository';

const ID = z.string().min(1).max(64);
const itemRefSchema = z.object({ collectionId: ID, itemId: z.uuid() });

const SLUG_TAKEN = 'Another item already uses this URL (or used it before).';

function collectionOrThrow(collectionId: string): AnyCollection {
  const collection = contentRegistry.collectionById(collectionId);
  if (!collection) throw new GuardError('Unknown collection.', ActionErrorCode.NotFound);
  return collection;
}

function invalidateItem(collectionId: string, slugs: readonly string[]): void {
  for (const slug of new Set(slugs)) updateTag(CacheTag.collectionItem(collectionId, slug));
  updateTag(CacheTag.collectionList(collectionId));
  updateTag(CacheTag.Sitemap);
}

/** Creates a draft item with a placeholder slug and returns its id (the editor opens next). */
export async function createItemAction(input: unknown): Promise<ActionResult<{ itemId: string }>> {
  return runAction(async () => {
    const user = await assertPermission(Permission.PagesEdit);
    const { collectionId } = z.object({ collectionId: ID }).parse(input);
    const collection = collectionOrThrow(collectionId);
    const db = await getDb();
    const slug = uniqueSlug(
      slugify(`new ${collection.itemLabel}`),
      await takenSlugs(db, collection.id),
    );
    const [created] = await db
      .insert(collectionItems)
      .values({
        collectionId: collection.id,
        slug,
        status: CollectionItemStatus.Draft,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: collectionItems.id });
    if (!created) throw new GuardError('Could not create the item.', ActionErrorCode.Conflict);
    await writeAudit(db, {
      action: AuditAction.ItemCreate,
      actor: { id: user.id, email: user.email },
      target: `item:${collection.id}:${created.id}`,
      summary: { collection: collection.label, slug },
    });
    return ok({ itemId: created.id }, `${collection.itemLabel} created as a draft.`);
  });
}

const versionsSchema = z.object({
  shared: z.number().int().min(0),
  localized: z.number().int().min(0),
  seo: z.number().int().min(0),
});

const saveItemSchema = itemRefSchema.extend({
  locale: z.string().min(2).max(16),
  content: z.unknown(),
  seo: z.unknown(),
  versions: versionsSchema,
  meta: z.unknown(),
});

export interface SaveItemResult {
  readonly versions: EditorVersions;
  readonly meta: ItemMeta;
}

/** Writes slug/status/date with a version check; keeps the old slug as a redirect. */
async function writeMeta(
  tx: Database,
  collectionId: string,
  itemId: string,
  before: { slug: string; status: CollectionItemStatus; publishedAt: Date | null },
  meta: ItemMeta,
  userId: string,
  contentChanged: boolean,
): Promise<{ changed: boolean; version: number; publishedAt: Date | null }> {
  const publishedAt = meta.publishedAt
    ? new Date(`${meta.publishedAt}T00:00:00Z`)
    : meta.status === CollectionItemStatus.Published
      ? (before.publishedAt ?? new Date())
      : null;
  const metaChanged =
    meta.slug !== before.slug ||
    meta.status !== before.status ||
    toDateInput(publishedAt) !== toDateInput(before.publishedAt);
  if (!metaChanged && !contentChanged)
    return { changed: false, version: meta.version, publishedAt };

  const [updated] = await tx
    .update(collectionItems)
    .set({
      slug: meta.slug,
      status: meta.status,
      publishedAt,
      version: sql`${collectionItems.version} + 1`,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(and(eq(collectionItems.id, itemId), eq(collectionItems.version, meta.version)))
    .returning({ version: collectionItems.version });
  if (!updated) {
    throw new GuardError(
      'Someone else saved this since you opened it. Reload to see their changes (your edits will be lost), or copy them first.',
      ActionErrorCode.Conflict,
    );
  }
  if (meta.slug !== before.slug) {
    // The old URL keeps working (308); reclaiming an old slug of this item drops its redirect.
    await tx
      .insert(collectionSlugRedirects)
      .values({ collectionId, oldSlug: before.slug, itemId })
      .onConflictDoUpdate({
        target: [collectionSlugRedirects.collectionId, collectionSlugRedirects.oldSlug],
        set: { itemId },
      });
    await tx
      .delete(collectionSlugRedirects)
      .where(
        and(
          eq(collectionSlugRedirects.collectionId, collectionId),
          eq(collectionSlugRedirects.oldSlug, meta.slug),
        ),
      );
  }
  return { changed: metaChanged, version: updated.version, publishedAt };
}

/** Saves an item's content + SEO in one locale together with its slug, status and date. */
export async function saveItemAction(input: unknown): Promise<ActionResult<SaveItemResult>> {
  return runAction(async () => {
    const user = await assertPermission(Permission.PagesEdit);
    const data = saveItemSchema.parse(input);
    const collection = collectionOrThrow(data.collectionId);
    const db = await getDb();
    const { general } = await readSiteSettings(db);
    if (!general.enabledLocales.includes(data.locale))
      throw new GuardError('This language is not enabled.', ActionErrorCode.Validation);
    const document = await resolveDocument({
      kind: DocumentKind.Item,
      collectionId: collection.id,
      itemId: data.itemId,
    });
    const before = await findItem(db, collection.id, data.itemId);
    if (!document || !before)
      throw new GuardError('This item no longer exists.', ActionErrorCode.NotFound);

    const validated = validateDocumentInput(document, data.content, data.seo);
    const meta = itemMetaSchema.safeParse(data.meta);
    const fieldErrors: Record<string, string[]> =
      'fieldErrors' in validated ? { ...validated.fieldErrors } : {};
    for (const issue of meta.error?.issues ?? [])
      (fieldErrors[`extra.${issue.path.join('.')}`] ??= []).push(issue.message);
    if (meta.success && meta.data.slug !== before.slug) {
      if ((await takenSlugs(db, collection.id, before.id)).has(meta.data.slug))
        (fieldErrors['extra.slug'] ??= []).push(SLUG_TAKEN);
    }
    if (!meta.success || 'fieldErrors' in validated || Object.keys(fieldErrors).length > 0) {
      return fail('Please fix the highlighted fields.', ActionErrorCode.Validation, fieldErrors);
    }

    let written = { changed: false, version: meta.data.version, publishedAt: before.publishedAt };
    const result = await saveDocument(
      db,
      document,
      {
        locale: data.locale,
        ...validated.data,
        versions: data.versions,
        author: { id: user.id, name: user.name },
      },
      async (tx, changed) => {
        written = await writeMeta(
          tx,
          collection.id,
          before.id,
          before,
          meta.data,
          user.id,
          changed.shared || changed.localized || changed.seo,
        );
        return written.changed;
      },
    );
    const nextMeta: ItemMeta = {
      ...meta.data,
      publishedAt: toDateInput(written.publishedAt),
      version: written.version,
    };
    const contentChanged = result.changed.shared || result.changed.localized || result.changed.seo;
    if (!contentChanged && !result.extraChanged) {
      return ok({ versions: result.versions, meta: nextMeta }, 'No changes to save.');
    }

    const actor = { id: user.id, email: user.email };
    const target = document.auditTarget(data.locale);
    const savedTitle = validated.data.content[ITEM_SECTION]?.[collection.titleField];
    const title =
      data.locale === general.defaultLocale && typeof savedTitle === 'string' && savedTitle
        ? savedTitle
        : document.label;
    if (contentChanged || meta.data.slug !== before.slug) {
      await writeAudit(db, {
        action: AuditAction.ContentSave,
        actor,
        target,
        summary: { ...result.changed, title, locale: data.locale, slug: meta.data.slug },
      });
    }
    if (meta.data.status !== before.status) {
      await writeAudit(db, {
        action:
          meta.data.status === CollectionItemStatus.Published
            ? AuditAction.ItemPublish
            : AuditAction.ItemUnpublish,
        actor,
        target,
        summary: { title, slug: meta.data.slug },
      });
    }
    invalidateItem(collection.id, [before.slug, meta.data.slug]);
    const message =
      meta.data.status === CollectionItemStatus.Published
        ? 'Saved. The live site updates in a few seconds.'
        : 'Saved as a draft (not visible on the site).';
    return ok({ versions: result.versions, meta: nextMeta }, message);
  });
}

/** Deletes an item with all its translations, SEO, revisions and redirects. */
export async function deleteItemAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertPermission(Permission.PagesEdit);
    const { collectionId, itemId } = itemRefSchema.parse(input);
    const collection = collectionOrThrow(collectionId);
    const document = await resolveDocument({ kind: DocumentKind.Item, collectionId, itemId });
    const db = await getDb();
    const item = await findItem(db, collection.id, itemId);
    if (!document || !item)
      throw new GuardError('This item no longer exists.', ActionErrorCode.NotFound);
    await db.delete(collectionItems).where(eq(collectionItems.id, item.id));
    await writeAudit(db, {
      action: AuditAction.ItemDelete,
      actor: { id: user.id, email: user.email },
      target: `item:${collection.id}:${item.id}`,
      summary: { title: document.label, slug: item.slug, collection: collection.label },
    });
    invalidateItem(collection.id, [item.slug]);
    return ok(null, `${collection.itemLabel} deleted.`);
  });
}

/** Live slug check for the editor: format and uniqueness within the collection. */
export async function checkSlugAction(
  input: unknown,
): Promise<ActionResult<{ valid: boolean; available: boolean }>> {
  return runAction(async (): Promise<ActionResult<{ valid: boolean; available: boolean }>> => {
    await assertPermission(Permission.PagesView);
    const { collectionId, itemId, slug } = itemRefSchema
      .extend({ slug: z.string().max(200) })
      .parse(input);
    const collection = collectionOrThrow(collectionId);
    if (!isValidSlug(slug)) return ok({ valid: false, available: false });
    const taken = await takenSlugs(await getDb(), collection.id, itemId);
    return ok({ valid: true, available: !taken.has(slug) });
  });
}
