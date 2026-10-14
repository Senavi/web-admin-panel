/**
 * `pnpm preview`: the real production build on your machine, against the local
 * PGlite database (.data/pglite), with no env vars needed. Use it to judge
 * speed: `pnpm dev` compiles every route on first visit and has no prefetch.
 *
 *   pnpm preview [--port 3300] [--skip-build]
 *
 * Builds into `.next-preview` (never touches `pnpm dev`'s `.next`). If `pnpm dev`
 * is running, its database server is reused; otherwise one is started here.
 * Same development admin and sessions as `pnpm dev`.
 */
import './lib/load-env';

import { type ChildProcess, spawn } from 'node:child_process';
import { createRequire } from 'node:module';

import { projectConfig } from '../project.config';

import { getAuthSecret } from '@/core/auth/secret';
import { findLocalServerUrl } from '@/core/db/drivers/local-server-info';
import { openPglite } from '@/core/db/drivers/pglite';
import { startPgliteServer } from '@/core/db/drivers/pglite-server';
import { runSeed } from '@/core/db/seed';

import { waitForPort } from './lib/process';

export const PREVIEW_DIST_DIR = '.next-preview';
const DEFAULT_PORT = 3300;
const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const PORT = portIndex >= 0 ? Number(args[portIndex + 1]) : DEFAULT_PORT;
const SKIP_BUILD = args.includes('--skip-build');

/** Production env with development-like defaults (local DB, local files, dev secret). */
function previewEnv(databaseUrl: string): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = {
    ...process.env,
    NEXT_DIST_DIR: PREVIEW_DIST_DIR,
    DATABASE_URL: databaseUrl,
    // The development secret (read before NODE_ENV becomes production), so sessions carry over.
    AUTH_SECRET: process.env.AUTH_SECRET ?? getAuthSecret(),
    NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
    STORAGE_DRIVER: 'local',
    ALLOW_LOCAL_STORAGE_IN_PRODUCTION: 'true',
    MAIL_PROVIDER: process.env.MAIL_PROVIDER ?? 'dev',
  };
  delete env.NODE_OPTIONS; // tsx's loader flags must not leak into Next.js
  delete env.NODE_ENV;
  return env as NodeJS.ProcessEnv;
}

/** The running dev server's database URL if it still accepts connections. */
async function reachable(url: string | null): Promise<string | null> {
  if (!url) return null;
  const port = Number(new URL(url).port);
  return waitForPort(port, 1000).then(
    () => url,
    () => null,
  );
}

async function main(): Promise<void> {
  let databaseUrl = await reachable(findLocalServerUrl());
  let stopDatabase = async () => undefined as void;
  if (databaseUrl) {
    console.info('[preview] Using the database of the running `pnpm dev`.');
  } else {
    const { db, client } = await openPglite();
    await runSeed(db, { seedDevAdmin: true });
    const server = await startPgliteServer(client, { port: 0 });
    databaseUrl = server.url;
    stopDatabase = async () => {
      await server.stop().catch(() => undefined);
      await client.close().catch(() => undefined);
    };
  }
  const env = previewEnv(databaseUrl);

  if (!SKIP_BUILD) {
    // Async: the database server runs in this process and must keep answering the build.
    const build = spawn(process.execPath, [nextBin, 'build'], { stdio: 'inherit', env });
    const status = await new Promise<number | null>((resolve) => build.on('exit', resolve));
    if (status !== 0) {
      await stopDatabase();
      process.exit(status ?? 1);
    }
  }
  const server: ChildProcess = spawn(process.execPath, [nextBin, 'start', '--port', String(PORT)], {
    stdio: 'inherit',
    env,
  });
  await waitForPort(PORT);
  console.info(
    `\n[preview] Production build running:\n  Site:  http://localhost:${PORT}\n  Admin: http://localhost:${PORT}${projectConfig.adminPath}\n  (development admin: .data/dev-admin-credentials.txt). Ctrl+C to stop.\n`,
  );

  const shutdown = async (code: number) => {
    server.kill('SIGTERM');
    await stopDatabase();
    process.exit(code);
  };
  server.on('exit', (code) => void shutdown(code ?? 0));
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => void shutdown(0));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
