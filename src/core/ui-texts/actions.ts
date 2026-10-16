'use server';

import { updateTag } from 'next/cache';
import { z } from 'zod';

import { ActionErrorCode, fail, ok, type ActionResult } from '@/core/actions/result';
import { GuardError, runAction } from '@/core/actions/run';
import { Permission } from '@/core/auth/permissions';
import { assertPermission } from '@/core/auth/server/session';
import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';
import { selectedLocales } from '@/core/i18n/language-state';
import { AuditAction, writeAudit } from '@/core/security/audit';
import { readSiteSettings } from '@/core/settings/repository';

import { applyUiTextEdits, MAX_UI_TEXT_LENGTH, resolveUiText, type UiTextEdits } from './model';
import { uiTextCatalog } from './project-catalog';
import { addUiRevision, readUiTexts, writeUiTexts } from './repository';
import { validateUiText } from './validate';

const saveSchema = z.object({
  namespace: z.string().min(1).max(64),
  locale: z.string().min(2).max(16),
  /** Changed texts only; `null` returns a text to its default. */
  edits: z
    .record(z.string().min(1).max(100), z.string().max(MAX_UI_TEXT_LENGTH).nullable())
    .refine((edits) => Object.keys(edits).length <= 200, 'Too many texts at once.'),
  /** Version of the saved row the editor loaded (0 = none yet). */
  version: z.number().int().min(0),
});

export interface SaveUiTextsResult {
  readonly version: number;
}

/** Saves edits to the interface texts of one namespace in one language. */
export async function saveUiTextsAction(input: unknown): Promise<ActionResult<SaveUiTextsResult>> {
  return runAction(async () => {
    const user = await assertPermission(Permission.PagesEdit);
    const data = saveSchema.parse(input);
    const { namespace, locale } = data;
    if (!uiTextCatalog.namespaceIds.includes(namespace))
      throw new GuardError('Unknown group of texts.', ActionErrorCode.NotFound);
    const db = await getDb();
    const { general } = await readSiteSettings(db);
    if (!selectedLocales(general).includes(locale))
      throw new GuardError('This language is not enabled.', ActionErrorCode.Validation);

    const keys = new Set(uiTextCatalog.keys(namespace));
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(data.edits)) {
      if (!keys.has(key)) throw new GuardError('Unknown text.', ActionErrorCode.NotFound);
      if (value === null) continue;
      const problem = validateUiText(uiTextCatalog.fileTexts('en', namespace)[key] ?? '', value);
      if (problem) fieldErrors[`edits.${key}`] = [problem];
    }
    if (Object.keys(fieldErrors).length > 0)
      return fail('Please fix the highlighted texts.', ActionErrorCode.Validation, fieldErrors);

    const result = await db.transaction(async (tx) => {
      const stored = await readUiTexts(tx, namespace, [locale, general.defaultLocale]);
      const current = stored[locale];
      const layers = {
        overrides: Object.fromEntries(
          Object.entries(stored).map(([code, row]) => [code, row.data]),
        ),
        locale,
        mainLocale: general.defaultLocale,
      };
      // What a language inherits is judged without its own edits.
      const inheritedLayers = {
        ...layers,
        overrides: { ...layers.overrides, [locale]: {} },
      };
      const next = applyUiTextEdits(
        current?.data ?? {},
        data.edits as UiTextEdits,
        (key) => resolveUiText(uiTextCatalog, namespace, key, inheritedLayers).value,
      );
      const before = current?.data ?? {};
      const changedKeys = [...new Set([...Object.keys(before), ...Object.keys(next)])].filter(
        (key) => before[key] !== next[key],
      );
      if (changedKeys.length === 0) return { version: current?.version ?? 0, changedKeys };

      const version = await writeUiTexts(tx, {
        namespace,
        locale,
        data: next,
        expected: data.version,
        userId: user.id,
      });
      if (version === null) {
        throw new GuardError(
          'Someone else saved these texts since you opened this page. Reload to see their changes (your edits will be lost), or copy them first.',
          ActionErrorCode.Conflict,
        );
      }
      if (current) {
        await addUiRevision(tx, {
          namespace,
          locale,
          snapshot: before,
          author: { id: user.id, name: user.name },
        });
      }
      return { version, changedKeys };
    });

    if (result.changedKeys.length === 0)
      return ok({ version: result.version }, 'No changes to save.');
    await writeAudit(db, {
      action: AuditAction.ContentSave,
      actor: { id: user.id, email: user.email },
      target: `ui:${namespace}:${locale}`,
      summary: { keys: result.changedKeys },
    });
    updateTag(CacheTag.ui(namespace));
    return ok({ version: result.version }, 'Saved. The live site updates in a few seconds.');
  });
}
