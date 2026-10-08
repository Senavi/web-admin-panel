import { timingSafeEqual } from 'node:crypto';

import { siteStateKey } from '@/core/site-gate/state-client';
import { SITE_STATE_KEY_HEADER } from '@/core/site-gate/state';
import { loadSiteState } from '@/core/site-gate/state-server';

/**
 * Internal endpoint read by the request proxy (which has no DB driver).
 * Requires an HMAC key derived from AUTH_SECRET; responds 404 to everyone else.
 */
export async function GET(request: Request): Promise<Response> {
  const provided = Buffer.from(request.headers.get(SITE_STATE_KEY_HEADER) ?? '');
  const expected = Buffer.from(await siteStateKey());
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return new Response('Not found', { status: 404 });
  }
  return Response.json(await loadSiteState(), {
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' },
  });
}
