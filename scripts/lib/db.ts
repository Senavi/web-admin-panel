import './load-env';

import { findLocalServerUrl } from '@/core/db/drivers/local-server-info';
import { openPglite } from '@/core/db/drivers/pglite';
import { openPostgres } from '@/core/db/drivers/postgres';
import type { Database } from '@/core/db/types';
import { connectionErrorHint, maskConnectionString, migrationUrl } from '@/core/db/connection-info';
import { env } from '@/core/env';

export interface ScriptDb {
  readonly db: Database;
  readonly label: string;
  readonly close: () => Promise<void>;
}

/** Opens the same database the app would use: Postgres when DATABASE_URL is set, else local PGlite. */
export async function openScriptDb(): Promise<ScriptDb> {
  const url = migrationUrl(env());
  if (url) {
    const { db, close } = openPostgres(url, { max: 1 });
    return { db, label: 'Postgres', close };
  }
  // While `pnpm dev` runs, it owns PGlite: connect through its local server.
  const localUrl = findLocalServerUrl();
  if (localUrl) {
    const { db, close } = openPostgres(localUrl, { max: 1 });
    return { db, label: 'local PGlite (via the running dev server)', close };
  }
  const { db, client } = await openPglite();
  return { db, label: 'local PGlite (.data/pglite)', close: () => client.close() };
}

/**
 * Runs a script body and exits with a non-zero code on failure. A network error
 * on an IPv6-only Supabase address (direct/dedicated, e.g. from Netlify/Vercel)
 * gets the plain-language fix; the password is never printed.
 */
export function runScript(main: () => Promise<void>): void {
  main().then(
    () => process.exit(0),
    (error: unknown) => {
      const url = migrationUrl({
        DATABASE_URL: process.env.DATABASE_URL,
        DIRECT_URL: process.env.DIRECT_URL,
      });
      const hint = url ? connectionErrorHint(error, url) : null;
      if (hint && url) {
        console.error(`Could not reach the database (${maskConnectionString(url)}).\n${hint}`);
      } else {
        console.error(error instanceof Error ? error.message : error);
      }
      process.exit(1);
    },
  );
}
