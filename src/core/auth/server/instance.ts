import 'server-only';

import { getDb } from '@/core/db/client';

import { createAuth, type Auth } from './config';

const globalState = globalThis as typeof globalThis & { __siteStarterAuth?: Promise<Auth> };

/** Lazily created Better Auth instance bound to the shared database. */
export function getAuth(): Promise<Auth> {
  globalState.__siteStarterAuth ??= getDb().then(createAuth);
  return globalState.__siteStarterAuth;
}
