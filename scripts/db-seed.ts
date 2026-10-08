import { runSeed } from '@/core/db/seed';
import { isProduction } from '@/core/env';

import { openScriptDb, runScript } from './lib/db';

runScript(async () => {
  const { db, label, close } = await openScriptDb();
  try {
    await runSeed(db, { seedDevAdmin: !isProduction() });
    console.info(`Seeded ${label}. Existing data was not modified.`);
  } finally {
    await close();
  }
});
