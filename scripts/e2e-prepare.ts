/**
 * Prepares the e2e database: resets the isolated local data dir (PGlite mode),
 * applies migrations + seed, and creates the e2e admin and manager.
 * With DATABASE_URL (CI Postgres) the database is expected to be fresh.
 */
import fs from 'node:fs';

import { Role } from '@/core/auth/roles';
import { createUserWithPassword, findUserByEmail } from '@/core/auth/server/users';
import { DATA_DIR } from '@/core/db/paths';
import { runSeed } from '@/core/db/seed';
import { env } from '@/core/env';

import { E2E_ADMIN, E2E_MANAGER } from '../tests/e2e/support/users';
import { openScriptDb, runScript } from './lib/db';

runScript(async () => {
  if (!env().DATABASE_URL) {
    if (!process.env.SITE_DATA_DIR)
      throw new Error('Refusing to reset the default .data directory.');
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
  const { db, close } = await openScriptDb();
  try {
    await runSeed(db, { seedDevAdmin: false });
    for (const [user, role] of [
      [E2E_ADMIN, Role.Admin],
      [E2E_MANAGER, Role.Manager],
    ] as const) {
      if (await findUserByEmail(db, user.email)) continue;
      await createUserWithPassword(db, { ...user, role, mustChangePassword: false });
    }
    console.info('E2E database prepared.');
  } finally {
    await close();
  }
});
