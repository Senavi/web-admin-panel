import { DatabaseProvider } from '@/core/db/connection-info';

/**
 * Database and file storage usage against the provider's free-plan limits
 * (D-096). Pure helpers; `database/usage-server.ts` reads the numbers.
 */
const MB = 1024 * 1024;
const GB = 1024 * MB;

export interface PlanLimits {
  readonly databaseBytes: number;
  readonly storageBytes: number;
  readonly plan: string;
}

/** Free-plan limits per project (paid plans are higher: check the provider's console). */
export const FREE_PLAN_LIMITS: Readonly<Record<DatabaseProvider, PlanLimits | null>> = {
  [DatabaseProvider.Neon]: { databaseBytes: 1 * GB, storageBytes: 5 * GB, plan: 'Neon free plan' },
  [DatabaseProvider.Supabase]: {
    databaseBytes: 500 * MB,
    storageBytes: 1 * GB,
    plan: 'Supabase free plan',
  },
  [DatabaseProvider.Postgres]: null,
};

/** Share of the limit at which the admin warns. */
export const USAGE_WARNING_RATIO = 0.8;

export interface UsageLine {
  readonly used: number;
  readonly limit: number | null;
  /** 0–1+, null without a known limit. */
  readonly ratio: number | null;
  readonly warn: boolean;
}

export function usageLine(used: number, limit: number | null): UsageLine {
  const ratio = limit ? used / limit : null;
  return { used, limit, ratio, warn: ratio !== null && ratio >= USAGE_WARNING_RATIO };
}

export function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(bytes >= 10 * GB ? 0 : 1)} GB`;
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "120 MB of 1 GB (12%)" or "120 MB" without a limit. */
export function describeUsage(line: UsageLine): string {
  if (line.limit === null || line.ratio === null) return formatBytes(line.used);
  return `${formatBytes(line.used)} of ${formatBytes(line.limit)} (${Math.round(line.ratio * 100)}%)`;
}

/** Warnings for the status card (empty when below 80 %). */
export function usageProblems(
  usage: { readonly database: UsageLine; readonly storage: UsageLine },
  plan: string,
): string[] {
  const problems: string[] = [];
  if (usage.database.warn)
    problems.push(
      `The database uses ${describeUsage(usage.database)} of the ${plan}. Upgrade the plan or clean up old data before it is full.`,
    );
  if (usage.storage.warn)
    problems.push(
      `Images use ${describeUsage(usage.storage)} of the ${plan}. Upgrade the plan or delete unused images.`,
    );
  return problems;
}
