import './lib/load-env';

import { openPglite } from '@/core/db/drivers/pglite';
import { migratePostgres } from '@/core/db/drivers/postgres';
import { env } from '@/core/env';

import { runScript } from './lib/db';

runScript(async () => {
  const { DATABASE_URL, DIRECT_URL } = env();
  const url = DIRECT_URL ?? DATABASE_URL;
  if (url) {
    await migratePostgres(url);
    console.info('Migrations applied to Postgres.');
    return;
  }
  const { client } = await openPglite();
  await client.close();
  console.info('Migrations applied to local PGlite (.data/pglite).');
});
