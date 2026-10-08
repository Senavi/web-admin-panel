/**
 * `pnpm dev`: zero-config development server.
 *
 * With DATABASE_URL set it simply runs `next dev`. Otherwise it opens the local
 * PGlite database (.data/pglite), applies migrations and seed data, serves it
 * over the Postgres protocol on 127.0.0.1, and starts `next dev` pointed at it
 * (Next.js uses several worker processes; PGlite is single-process).
 * Extra arguments are passed to `next dev`, e.g. `pnpm dev --port 3100`.
 */
import './lib/load-env';

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

import {
  PGLITE_SERVER_URL_ENV,
  removeLocalServerInfo,
  writeLocalServerInfo,
} from '@/core/db/drivers/local-server-info';
import { openPglite } from '@/core/db/drivers/pglite';
import { startPgliteServer } from '@/core/db/drivers/pglite-server';
import { runSeed } from '@/core/db/seed';

const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
const args = process.argv.slice(2);

function startNext(extraEnv: Record<string, string>) {
  const env = { ...process.env, ...extraEnv };
  // tsx's loader flags must not leak into Next.js.
  delete env.NODE_OPTIONS;
  return spawn(process.execPath, [nextBin, 'dev', ...args], { stdio: 'inherit', env });
}

async function main(): Promise<void> {
  if (process.env.DATABASE_URL) {
    const child = startNext({});
    child.on('exit', (code) => process.exit(code ?? 0));
    return;
  }

  const { db, client } = await openPglite();
  await runSeed(db, { seedDevAdmin: true });
  const server = await startPgliteServer(client, { port: Number(process.env.PGLITE_PORT) || 0 });
  writeLocalServerInfo({ url: server.url, pid: process.pid });
  console.info(
    `[dev] Local database (PGlite) ready, serving Next.js on ${server.url.replace(/\/\/.*@/, '//')}`,
  );

  const child = startNext({ [PGLITE_SERVER_URL_ENV]: server.url });
  let shuttingDown = false;
  const shutdown = async (code: number) => {
    if (shuttingDown) return;
    shuttingDown = true;
    removeLocalServerInfo();
    await server.stop().catch(() => undefined);
    await client.close().catch(() => undefined);
    process.exit(code);
  };
  child.on('exit', (code) => void shutdown(code ?? 0));
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      child.kill(signal);
      setTimeout(() => void shutdown(0), 5000).unref();
    });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
