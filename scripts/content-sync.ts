/**
 * Seeds missing pages / fields from the content schema without overwriting
 * edited content, imports seed images, and reports orphaned fields.
 *
 *   pnpm content:sync
 */
import { syncContent } from '@/core/content/sync';
import { getStorage } from '@/core/storage';

import { openScriptDb, runScript } from './lib/db';

runScript(async () => {
  const { db, label, close } = await openScriptDb();
  try {
    const report = await syncContent(db, getStorage());
    console.info(`Content sync (${label})`);
    console.info(
      `  rows created:     ${report.created.length ? report.created.join(', ') : 'none'}`,
    );
    console.info(`  fields filled:    ${report.filled.length}`);
    for (const item of report.filled) console.info(`    + ${item}`);
    console.info(
      `  images imported:  ${report.assetsImported.length ? report.assetsImported.join(', ') : 'none'}`,
    );
    if (report.orphans.length > 0) {
      console.warn(`  orphaned fields (kept, not deleted): ${report.orphans.length}`);
      for (const item of report.orphans) console.warn(`    ? ${item}`);
    }
  } finally {
    await close();
  }
});
