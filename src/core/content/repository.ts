import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';

import { pageContent, SHARED_LOCALE } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

import type { ContentRecord, StoredRows } from './values';

export interface PageRows {
  readonly shared: ContentRecord | undefined;
  readonly byLocale: ReadonlyMap<string, ContentRecord>;
  readonly versions: ReadonlyMap<string, number>;
  readonly updatedAt: Date | null;
}

/** Shared + localized content rows of one page in a single query. */
export async function readPageRows(
  db: Database,
  pageId: string,
  locales: readonly string[],
): Promise<PageRows> {
  const rows = await db
    .select()
    .from(pageContent)
    .where(
      and(eq(pageContent.pageId, pageId), inArray(pageContent.locale, [SHARED_LOCALE, ...locales])),
    );
  const byLocale = new Map<string, ContentRecord>();
  const versions = new Map<string, number>();
  let shared: ContentRecord | undefined;
  let updatedAt: Date | null = null;
  for (const row of rows) {
    versions.set(row.locale, row.version);
    if (!updatedAt || row.updatedAt > updatedAt) updatedAt = row.updatedAt;
    if (row.locale === SHARED_LOCALE) shared = row.data as ContentRecord;
    else byLocale.set(row.locale, row.data as ContentRecord);
  }
  return { shared, byLocale, versions, updatedAt };
}

export function storedRowsFor(rows: PageRows, locale: string): StoredRows {
  return { shared: rows.shared, localized: rows.byLocale.get(locale) };
}
