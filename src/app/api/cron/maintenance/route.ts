import { timingSafeEqual } from 'node:crypto';

import { runMaintenance } from '@/core/maintenance';
import { getDb } from '@/core/db/client';
import { env } from '@/core/env';

/**
 * Scheduled maintenance (analytics rollups, form delivery retries, retention cleanup).
 * Vercel Cron and the Netlify scheduled function call it with
 * `Authorization: Bearer $CRON_SECRET`. Disabled when CRON_SECRET is unset;
 * the same work also runs lazily, so the app is correct without a scheduler.
 */
async function handle(request: Request): Promise<Response> {
  const secret = env().CRON_SECRET;
  if (!secret) return new Response('Not found', { status: 404 });
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return new Response('Unauthorized', { status: 401 });
  }
  const summary = await runMaintenance(await getDb(), { force: true });
  return Response.json(summary, { headers: { 'Cache-Control': 'no-store' } });
}

export { handle as GET, handle as POST };
