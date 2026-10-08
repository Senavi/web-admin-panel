import { DbMode, type DbInfo } from './types';

/** Describes the active database without exposing credentials. */
export function describeDatabase(databaseUrl: string | undefined): DbInfo {
  if (!databaseUrl) return { mode: DbMode.Local, host: null };
  try {
    const url = new URL(databaseUrl);
    return { mode: DbMode.Postgres, host: url.port ? `${url.hostname}:${url.port}` : url.hostname };
  } catch {
    return { mode: DbMode.Postgres, host: null };
  }
}
