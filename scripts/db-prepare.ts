/**
 * Prepares a migrated database for the app (run by `pnpm db:migrate:deploy`):
 * RLS + media bucket on Supabase, default settings and missing demo content, and
 * the environment marker of production and staging databases (D-098).
 */
import { prepareDatabase } from '@/core/database/prepare';
import { databaseIdentity, migrationUrl } from '@/core/db/connection-info';
import { deploymentEnvironment } from '@/core/deployment/environment';
import { env } from '@/core/env';

import { projectConfig } from '../project.config';

import { openScriptDb, runScript } from './lib/db';

runScript(async () => {
  const { db, label, close } = await openScriptDb();
  try {
    const url = migrationUrl(env());
    const done = await prepareDatabase(db, {
      environment: deploymentEnvironment(process.env, projectConfig.stagingBranch),
      identity: url ? databaseIdentity(url) : null,
    });
    console.info(`[prepare] ${label}: ${done.join('; ')}.`);
  } finally {
    await close();
  }
});
