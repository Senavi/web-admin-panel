import 'server-only';

import { and, eq, gte, lt, sql } from 'drizzle-orm';

import { contentRegistry } from '@/core/content/project-registry';
import { formSubmissions, systemJobs } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { readSiteSettings } from '@/core/settings/repository';

import {
  DeliveryStatus,
  type Destination,
  deliverSubmission,
  enabledDestinations,
  MAX_DELIVERY_ATTEMPTS,
} from './delivery';

export const FORMS_JOB = 'forms-maintenance';
/** Lazy runs (Overview) happen at most this often; the cron endpoint forces a run. */
const LAZY_INTERVAL_MS = 15 * 60 * 1000;
/** Failed deliveries older than this are no longer retried. */
const RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface FormsMaintenanceSummary {
  readonly skipped: boolean;
  readonly retried: number;
  readonly delivered: number;
  readonly deletedSubmissions: number;
}

/** Retries failed deliveries (up to MAX_DELIVERY_ATTEMPTS) and enforces retention. */
export async function runFormsMaintenance(
  db: Database,
  options: { force?: boolean; now?: Date } = {},
): Promise<FormsMaintenanceSummary> {
  const now = options.now ?? new Date();
  const [job] = await db.select().from(systemJobs).where(eq(systemJobs.name, FORMS_JOB));
  if (!options.force && job && now.getTime() - job.lastRunAt.getTime() < LAZY_INTERVAL_MS) {
    return { skipped: true, retried: 0, delivered: 0, deletedSubmissions: 0 };
  }
  await db
    .insert(systemJobs)
    .values({ name: FORMS_JOB, lastRunAt: now, runs: 1 })
    .onConflictDoUpdate({
      target: systemJobs.name,
      set: { lastRunAt: now, runs: sql`${systemJobs.runs} + 1` },
    });

  const { forms } = await readSiteSettings(db);
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - forms.retentionMonths);
  const deleted = await db
    .delete(formSubmissions)
    .where(lt(formSubmissions.createdAt, cutoff))
    .returning({ id: formSubmissions.id });

  const candidates = await db
    .select()
    .from(formSubmissions)
    .where(
      and(
        gte(formSubmissions.createdAt, new Date(now.getTime() - RETRY_WINDOW_MS)),
        sql`${formSubmissions.delivery}::text like '%"failed"%'`,
      ),
    );
  let retried = 0;
  let delivered = 0;
  for (const row of candidates) {
    const form = contentRegistry.formById(row.formId);
    const config = forms.destinations[row.formId];
    if (!form || !config) continue;
    const enabled = new Set(enabledDestinations(config));
    const failed = Object.entries(row.delivery)
      .filter(
        ([destination, record]) =>
          enabled.has(destination as Destination) &&
          record.status === DeliveryStatus.Failed &&
          record.attempts < MAX_DELIVERY_ATTEMPTS,
      )
      .map(([destination]) => destination as Destination);
    if (failed.length === 0) continue;
    retried += failed.length;
    const next = await deliverSubmission(
      db,
      form,
      {
        id: row.id,
        formId: row.formId,
        locale: row.locale,
        pagePath: row.pagePath,
        createdAt: row.createdAt,
        data: row.data,
      },
      config,
      failed,
      row.delivery,
    );
    delivered += failed.filter((d) => next[d]?.status === DeliveryStatus.Sent).length;
  }

  const summary = { skipped: false, retried, delivered, deletedSubmissions: deleted.length };
  await db
    .update(systemJobs)
    .set({ lastResult: { ...summary } })
    .where(eq(systemJobs.name, FORMS_JOB));
  return summary;
}
