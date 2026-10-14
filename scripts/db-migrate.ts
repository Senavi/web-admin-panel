import './lib/load-env';

import { openPglite } from '@/core/db/drivers/pglite';
import { migratePostgres } from '@/core/db/drivers/postgres';
import { maskConnectionString, migrationUrl } from '@/core/db/connection-info';
import { env } from '@/core/env';

import { runScript } from './lib/db';

runScript(async () => {
  const url = migrationUrl(env());
  if (url) {
    await migratePostgres(url);
    console.info(`Migrations applied to Postgres (${maskConnectionString(url)}).`);
    return;
  }
  const { client } = await openPglite();
  await client.close();
  console.info('Migrations applied to local PGlite (.data/pglite).');
});
