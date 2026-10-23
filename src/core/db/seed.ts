import { seedDevAdmin } from '@/core/auth/server/seed-admin';
import { syncContent, updatedDocuments } from '@/core/content/sync';
import { seedSettings } from '@/core/settings/seed';

import type { Database } from './types';

export interface SeedOptions {
  /** Development only: create the admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. */
  readonly seedDevAdmin: boolean;
}

export interface SeedStep {
  readonly name: string;
  readonly run: (db: Database, options: SeedOptions) => Promise<void>;
}

/**
 * Idempotent seed steps, run on first start of the local database and by
 * `pnpm db:seed`. Each step must only insert missing data.
 */
export const seedSteps: SeedStep[] = [
  { name: 'settings', run: (db) => seedSettings(db) },
  // Fills missing content and moves never-edited fields to changed seeds (D-095).
  {
    name: 'content',
    run: async (db) => {
      const { getStorage } = await import('@/core/storage');
      const report = await syncContent(db, getStorage());
      // Seed fixes merged by a teammate reach untouched texts: say so in the dev/deploy log.
      if (report.updated.length > 0)
        console.info(
          `[content] Updated from code (never edited): ${report.updated.length} field(s) in ${updatedDocuments(report).join(', ')}.`,
        );
    },
  },
  {
    name: 'dev-admin',
    run: (db, options) => (options.seedDevAdmin ? seedDevAdmin(db) : Promise.resolve()),
  },
];

export async function runSeed(db: Database, options: SeedOptions): Promise<void> {
  for (const step of seedSteps) {
    await step.run(db, options);
  }
}
