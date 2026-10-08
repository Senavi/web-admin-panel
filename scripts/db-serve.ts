/**
 * Serves the local PGlite database (.data/pglite) as a Postgres server so a
 * production build can be tried locally without Supabase:
 *
 *   pnpm db:serve                       # prints DATABASE_URL, keep it running
 *   DATABASE_URL=… AUTH_SECRET=… NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
 *     STORAGE_DRIVER=local ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true pnpm build && pnpm start
 *
 * Note: the app then runs in "Postgres" mode (no local database banner).
 */
import './lib/load-env';

import { openPglite } from '@/core/db/drivers/pglite';
import { startPgliteServer } from '@/core/db/drivers/pglite-server';
import { runSeed } from '@/core/db/seed';

const DEFAULT_PORT = 54329;

async function main(): Promise<void> {
  const { db, client } = await openPglite();
  await runSeed(db, { seedDevAdmin: true });
  const server = await startPgliteServer(client, {
    port: Number(process.env.PGLITE_PORT) || DEFAULT_PORT,
  });
  console.info(`DATABASE_URL=${server.url}`);
  console.info('Serving .data/pglite. Press Ctrl+C to stop.');
  const stop = async () => {
    await server.stop();
    await client.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
