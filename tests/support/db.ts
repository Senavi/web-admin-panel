import { openPglite } from '@/core/db/drivers/pglite';
import type { Database } from '@/core/db/types';

/** Fresh, migrated in-memory database for a test file. */
export async function createTestDb(): Promise<{ db: Database; close: () => Promise<void> }> {
  const { db, client } = await openPglite({ dataDir: null });
  return { db, close: () => client.close() };
}
