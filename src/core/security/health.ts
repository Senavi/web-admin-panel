import 'server-only';

import { sql } from 'drizzle-orm';

import { getDb, getDbInfo } from '@/core/db/client';
import type { DbInfo } from '@/core/db/types';
import { getStorage } from '@/core/storage';

export interface DatabaseHealth extends DbInfo {
  readonly ok: boolean;
  readonly latencyMs: number | null;
  readonly error: string | null;
}

export async function checkDatabase(): Promise<DatabaseHealth> {
  const info = getDbInfo();
  const started = performance.now();
  try {
    await (await getDb()).execute(sql`select 1`);
    return { ...info, ok: true, latencyMs: Math.round(performance.now() - started), error: null };
  } catch (error) {
    return {
      ...info,
      ok: false,
      latencyMs: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export interface StorageHealth {
  readonly driver: string;
  readonly location: string;
  readonly ok: boolean;
  readonly error: string | null;
}

export async function checkStorage(): Promise<StorageHealth> {
  const storage = getStorage();
  const result = await storage.check();
  return {
    driver: storage.driver,
    location: storage.location,
    ok: result.ok,
    error: result.ok ? null : result.error,
  };
}
