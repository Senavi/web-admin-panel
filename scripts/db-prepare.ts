/**
 * Prepares a migrated database for the app (run by `pnpm db:migrate:deploy`):
 * RLS + media bucket on Supabase, default settings and missing demo content.
 */
import { prepareDatabase } from '@/core/database/prepare';

import { openScriptDb, runScript } from './lib/db';

runScript(async () => {
  const { db, label, close } = await openScriptDb();
  try {
    const done = await prepareDatabase(db);
    console.info(`[prepare] ${label}: ${done.join('; ')}.`);
  } finally {
    await close();
  }
});
