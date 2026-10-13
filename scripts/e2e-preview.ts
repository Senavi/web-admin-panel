/**
 * Preview-mode E2E: a production build with NO environment variables (as on a
 * fresh Netlify/Vercel import), then the specs in tests/e2e-preview.
 *
 *   pnpm e2e:preview [playwright args]
 *
 * Builds into `.next-preview` so the regular `.next` build is untouched.
 */
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';

const APP_PORT = Number(process.env.E2E_PREVIEW_PORT ?? 3500);
const DIST_DIR = '.next-preview';
/** Next.js loads these files during build/start; they must not configure a database here. */
const ENV_FILES = ['.env', '.env.local', '.env.production', '.env.production.local'];

/** Only what the tools need to run: no database, secrets or site URL. */
const cleanEnv = {
  PATH: process.env.PATH ?? '',
  HOME: process.env.HOME ?? '',
  NEXT_DIST_DIR: DIST_DIR,
  NEXT_TELEMETRY_DISABLED: '1',
  ...(process.env.CI ? { CI: process.env.CI } : {}),
} as unknown as NodeJS.ProcessEnv;

let server: ChildProcess | undefined;

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

async function main(): Promise<number> {
  const configured = ENV_FILES.filter(
    (file) =>
      fs.existsSync(file) && /^\s*DATABASE_URL\s*=\s*\S/m.test(fs.readFileSync(file, 'utf8')),
  );
  if (configured.length > 0) {
    throw new Error(`Remove DATABASE_URL from ${configured.join(', ')} to test preview mode.`);
  }
  const build = spawnSync('pnpm', ['build'], { stdio: 'inherit', env: cleanEnv });
  if (build.status !== 0) throw new Error('pnpm build without environment variables failed');
  server = spawn('pnpm', ['exec', 'next', 'start', '--port', String(APP_PORT)], {
    stdio: 'inherit',
    env: cleanEnv,
  });
  await waitForPort(APP_PORT);
  const tests = spawnSync(
    'pnpm',
    ['exec', 'playwright', 'test', '-c', 'playwright.preview.config.ts', ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      env: { ...process.env, E2E_BASE_URL: `http://localhost:${APP_PORT}` },
    },
  );
  return tests.status ?? 1;
}

process.on('SIGINT', () => {
  server?.kill('SIGTERM');
  process.exit(130);
});

main().then(
  (code) => {
    server?.kill('SIGTERM');
    process.exit(code);
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    server?.kill('SIGTERM');
    process.exit(1);
  },
);
