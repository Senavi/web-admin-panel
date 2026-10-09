import 'server-only';

import { runAnalyticsMaintenance } from '@/core/analytics/maintenance';
import type { Database } from '@/core/db/types';
import { runFormsMaintenance } from '@/core/forms/maintenance';

/**
 * All scheduled maintenance (analytics rollups + retention, form delivery
 * retries + retention). Called by the cron endpoint (forced) and lazily
 * (throttled per job) from page views and the Overview.
 */
export async function runMaintenance(db: Database, options: { force?: boolean } = {}) {
  const analytics = await runAnalyticsMaintenance(db, options);
  const forms = await runFormsMaintenance(db, options);
  return { analytics, forms };
}
