import 'server-only';

import type { Database } from '@/core/db/types';

import { type DocumentRows, storedRowsFor } from './store';
import { pageStore } from './stores/page-store';

/** Shared + localized content rows of one page-table document in a single query. */
export type PageRows = DocumentRows;

export function readPageRows(
  db: Database,
  pageId: string,
  locales: readonly string[],
): Promise<PageRows> {
  return pageStore.readRows(db, pageId, locales);
}

export { storedRowsFor };
