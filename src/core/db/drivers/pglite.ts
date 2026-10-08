import fs from 'node:fs';

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

import { DATA_DIR, MIGRATIONS_DIR, PGLITE_DIR, PGLITE_LOCK_FILE } from '../paths';
import * as schema from '../schema';
import type { Database } from '../types';

/**
 * PGlite is single-process: two processes opening the same data directory
 * corrupt it. A pid lock file turns that into a clear error instead.
 */
function acquireLock(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(PGLITE_LOCK_FILE)) {
    const pid = Number(fs.readFileSync(PGLITE_LOCK_FILE, 'utf8'));
    if (pid && pid !== process.pid && isProcessAlive(pid)) {
      throw new Error(
        `The local PGlite database (.data/pglite) is in use by process ${pid} (usually \`pnpm dev\`). ` +
          'Stop it before running this command, or set DATABASE_URL to use Postgres.',
      );
    }
  }
  fs.writeFileSync(PGLITE_LOCK_FILE, String(process.pid));
  const release = () => {
    try {
      if (Number(fs.readFileSync(PGLITE_LOCK_FILE, 'utf8')) === process.pid) {
        fs.unlinkSync(PGLITE_LOCK_FILE);
      }
    } catch {
      // Lock already gone.
    }
  };
  process.once('exit', release);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export interface PgliteConnection {
  readonly db: Database;
  readonly client: PGlite;
}

/** Opens PGlite. `dataDir: null` creates an in-memory database (tests). */
export async function openPglite(
  options: { dataDir?: string | null } = {},
): Promise<PgliteConnection> {
  const dataDir = options.dataDir === undefined ? PGLITE_DIR : options.dataDir;
  if (dataDir) acquireLock();
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  await client.waitReady;
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db, client };
}
