import fs from 'node:fs';

import { PGLITE_SERVER_FILE } from '../paths';

/** Env var `pnpm dev` passes to Next.js with the local PGlite server URL. */
export const PGLITE_SERVER_URL_ENV = 'PGLITE_SERVER_URL';

export interface LocalServerInfo {
  readonly url: string;
  readonly pid: number;
}

/** URL of the running local PGlite server (from env or the info file), if any. */
export function findLocalServerUrl(): string | null {
  const fromEnv = process.env[PGLITE_SERVER_URL_ENV];
  if (fromEnv) return fromEnv;
  try {
    const info = JSON.parse(fs.readFileSync(PGLITE_SERVER_FILE, 'utf8')) as LocalServerInfo;
    process.kill(info.pid, 0); // Throws if the dev server is gone.
    return info.url;
  } catch {
    return null;
  }
}

export function writeLocalServerInfo(info: LocalServerInfo): void {
  fs.writeFileSync(PGLITE_SERVER_FILE, JSON.stringify(info));
}

export function removeLocalServerInfo(): void {
  fs.rmSync(PGLITE_SERVER_FILE, { force: true });
}
