import 'server-only';

import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';

import { uiTextRevisions, uiTexts } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

import type { FlatTexts } from './model';

export interface StoredUiTexts {
  readonly data: FlatTexts;
  /** 0 when the row does not exist yet. */
  readonly version: number;
}

/** Saved texts of one namespace in the given languages. */
export async function readUiTexts(
  db: Database,
  namespace: string,
  locales: readonly string[],
): Promise<Record<string, StoredUiTexts>> {
  const rows = await db
    .select()
    .from(uiTexts)
    .where(and(eq(uiTexts.namespace, namespace), inArray(uiTexts.locale, [...locales])));
  return Object.fromEntries(
    rows.map((row) => [row.locale, { data: row.data, version: row.version }]),
  );
}

/** Saved texts of every namespace in the given languages: `{ [namespace]: { [locale]: row } }`. */
export async function readAllUiTexts(
  db: Database,
  locales: readonly string[],
): Promise<Record<string, Record<string, StoredUiTexts>>> {
  const rows = await db
    .select()
    .from(uiTexts)
    .where(inArray(uiTexts.locale, [...locales]));
  const result: Record<string, Record<string, StoredUiTexts>> = {};
  for (const row of rows)
    (result[row.namespace] ??= {})[row.locale] = { data: row.data, version: row.version };
  return result;
}

/**
 * Writes a namespace/language row if its version is still `expected` (0 = not
 * created yet). Returns the new version, or null when someone else saved first.
 */
export async function writeUiTexts(
  tx: Database,
  input: {
    namespace: string;
    locale: string;
    data: FlatTexts;
    expected: number;
    userId: string;
  },
): Promise<number | null> {
  const { namespace, locale, data, expected, userId } = input;
  if (expected === 0) {
    const inserted = await tx
      .insert(uiTexts)
      .values({ namespace, locale, data, updatedBy: userId })
      .onConflictDoNothing()
      .returning({ version: uiTexts.version });
    return inserted[0]?.version ?? null;
  }
  const updated = await tx
    .update(uiTexts)
    .set({
      data,
      version: sql`${uiTexts.version} + 1`,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(
      and(
        eq(uiTexts.namespace, namespace),
        eq(uiTexts.locale, locale),
        eq(uiTexts.version, expected),
      ),
    )
    .returning({ version: uiTexts.version });
  return updated[0]?.version ?? null;
}

export const MAX_UI_REVISIONS = 20;

/** Keeps the state a row had before a save, and the last MAX_UI_REVISIONS of them. */
export async function addUiRevision(
  tx: Database,
  input: {
    namespace: string;
    locale: string;
    snapshot: FlatTexts;
    author: { id: string; name: string };
  },
): Promise<void> {
  const { namespace, locale, snapshot, author } = input;
  await tx.insert(uiTextRevisions).values({
    namespace,
    locale,
    snapshot,
    authorId: author.id,
    authorName: author.name,
  });
  // The row just after the newest MAX_UI_REVISIONS, and everything older.
  const [oldest] = await tx
    .select({ createdAt: uiTextRevisions.createdAt })
    .from(uiTextRevisions)
    .where(and(eq(uiTextRevisions.namespace, namespace), eq(uiTextRevisions.locale, locale)))
    .orderBy(desc(uiTextRevisions.createdAt))
    .limit(1)
    .offset(MAX_UI_REVISIONS);
  if (oldest) {
    await tx
      .delete(uiTextRevisions)
      .where(
        and(
          eq(uiTextRevisions.namespace, namespace),
          eq(uiTextRevisions.locale, locale),
          lte(uiTextRevisions.createdAt, oldest.createdAt),
        ),
      );
  }
}
