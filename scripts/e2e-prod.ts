/**
 * End-to-end tests against a PRODUCTION build, locally and without Docker:
 *
 *   pnpm e2e:prod [playwright args]
 *
 * 1. serves an isolated PGlite database (.data/e2e-prod) over the Postgres protocol,
 * 2. prepares it (migrations, seed, e2e users),
 * 3. runs `next build` + `next start` against it (Postgres mode, local storage),
 * 4. runs Playwright with E2E_BASE_URL, then stops everything.
 *
 * CI runs the same flow against a real Postgres service container.
 */
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';

import { E2E_ENV } from '../tests/e2e/support/env';

const DB_PORT = Number(process.env.E2E_DB_PORT ?? 54339);
const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3400);
const DATA_DIR = '.data/e2e-prod';
const children: ChildProcess[] = [];

const env: Record<string, string | undefined> = {
  ...process.env,
  SITE_DATA_DIR: DATA_DIR,
  DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`,
  AUTH_SECRET: process.env.AUTH_SECRET ?? 'e2e-production-secret-0123456789abcdef',
  NEXT_PUBLIC_SITE_URL: `http://localhost:${APP_PORT}`,
  STORAGE_DRIVER: 'local',
  ALLOW_LOCAL_STORAGE_IN_PRODUCTION: 'true',
  ...E2E_ENV,
};
delete env.NODE_OPTIONS;

/** Child process environment (Next's types require NODE_ENV, which `next` sets itself). */
function childEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...env, ...extra } as NodeJS.ProcessEnv;
}

function run(command: string, args: string[], extra: Record<string, string> = {}): void {
  const result = spawnSync(command, args, { stdio: 'inherit', env: childEnv(extra) });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
}

function start(command: string, args: string[], extra: Record<string, string> = {}): ChildProcess {
  const child = spawn(command, args, { stdio: 'inherit', env: childEnv(extra) });
  children.push(child);
  return child;
}

async function waitForPort(port: number, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = await new Promise<boolean>((resolve) => {
      const socket = net.connect(port, '127.0.0.1', () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
    });
    if (open) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Port ${port} did not open in time.`);
}

function cleanup(): void {
  for (const child of children) child.kill('SIGTERM');
}

async function main(): Promise<number> {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  start('pnpm', ['db:serve'], { DATABASE_URL: '', PGLITE_PORT: String(DB_PORT) });
  await waitForPort(DB_PORT);
  run('pnpm', ['e2e:prepare']);
  run('pnpm', ['build']);
  start('pnpm', ['start', '--port', String(APP_PORT)]);
  await waitForPort(APP_PORT);
  const tests = spawnSync('pnpm', ['exec', 'playwright', 'test', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: childEnv({ E2E_BASE_URL: `http://localhost:${APP_PORT}` }),
  });
  return tests.status ?? 1;
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

main().then(
  (code) => {
    cleanup();
    process.exit(code);
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    cleanup();
    process.exit(1);
  },
);
