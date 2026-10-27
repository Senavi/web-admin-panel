import 'server-only';

import { sql, sum } from 'drizzle-orm';

import { databaseProvider } from '@/core/db/connection-info';
import { getDb } from '@/core/db/client';
import { executeRows } from '@/core/db/execute';
import { media } from '@/core/db/schema';
import { env } from '@/core/env';

import { FREE_PLAN_LIMITS, usageLine, type UsageLine } from './usage';

export interface SiteUsage {
  readonly database: UsageLine;
  readonly storage: UsageLine;
  /** Free-plan name the limits come from, or null (local / other Postgres). */
  readonly plan: string | null;
}

/** Database size (`pg_database_size`) and the total size of uploaded images. */
export async function readUsage(): Promise<SiteUsage> {
  const db = await getDb();
  const [size] = await executeRows<{ bytes: string | number }>(
    db,
    sql`select pg_database_size(current_database()) as bytes`,
  );
  const [files] = await db.select({ bytes: sum(media.size) }).from(media);
  const provider = databaseProvider(env().DATABASE_URL);
  const limits = provider ? FREE_PLAN_LIMITS[provider] : null;
  return {
    database: usageLine(Number(size?.bytes ?? 0), limits?.databaseBytes ?? null),
    storage: usageLine(Number(files?.bytes ?? 0), limits?.storageBytes ?? null),
    plan: limits?.plan ?? null,
  };
}
