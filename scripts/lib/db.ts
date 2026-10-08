import './load-env';

import { openPglite } from '@/core/db/drivers/pglite';
import { openPostgres } from '@/core/db/drivers/postgres';
import type { Database } from '@/core/db/types';
import { env } from '@/core/env';

export interface ScriptDb {
  readonly db: Database;
  readonly label: string;
  readonly close: () => Promise<void>;
}

/** Opens the same database the app would use: Postgres when DATABASE_URL is set, else local PGlite. */
export async function openScriptDb(): Promise<ScriptDb> {
  const { DATABASE_URL, DIRECT_URL } = env();
  const url = DIRECT_URL ?? DATABASE_URL;
  if (url) {
    const { db, close } = openPostgres(url, { max: 1 });
    return { db, label: 'Postgres', close };
  }
  const { db, client } = await openPglite();
  return { db, label: 'local PGlite (.data/pglite)', close: () => client.close() };
}

/** Runs a script body and exits with a non-zero code on failure. */
export function runScript(main: () => Promise<void>): void {
  main().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
