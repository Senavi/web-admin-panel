import 'server-only';

import { runAnalyticsMaintenance } from '@/core/analytics/maintenance';
import type { Database } from '@/core/db/types';
import { currentEnvironment } from '@/core/deployment/current';
import { maintenanceMayDelete } from '@/core/deployment/rules';
import { runFormsMaintenance } from '@/core/forms/maintenance';

/**
 * All scheduled maintenance (analytics rollups + retention, form delivery
 * retries + retention). Called by the cron endpoint (forced) and lazily
 * (throttled per job) from page views and the Overview. Staging deletes nothing.
 */
export async function runMaintenance(db: Database, options: { force?: boolean } = {}) {
  const run = { ...options, mayDelete: maintenanceMayDelete(currentEnvironment()) };
  const analytics = await runAnalyticsMaintenance(db, run);
  const forms = await runFormsMaintenance(db, run);
  return { analytics, forms };
}
