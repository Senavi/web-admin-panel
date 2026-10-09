import { after } from 'next/server';

import { collectPayloadSchema, recordPageView } from '@/core/analytics/collect';
import { runMaintenance } from '@/core/maintenance';
import { getAuthSecret } from '@/core/auth/secret';
import { getDb } from '@/core/db/client';
import { getClientIp } from '@/core/security/request';
import { readSiteSettings } from '@/core/settings/repository';
import { isStaffToken } from '@/core/site-gate/staff';
import { loadSiteState } from '@/core/site-gate/state-server';
import { GATE_COOKIE_NAME } from '@/core/site-gate/token';

const MAX_BODY_BYTES = 2048;
const NO_CONTENT = () =>
  new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

function sameSite(request: Request, host: string): boolean {
  const source = request.headers.get('origin') ?? request.headers.get('referer');
  if (!source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

function readCookie(request: Request, name: string): string | undefined {
  const match = request.headers.get('cookie')?.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match?.[1];
}

/**
 * Page-view beacon (navigator.sendBeacon from public/a.js). Always answers 204
 * so it never leaks why a hit was ignored.
 */
export async function POST(request: Request): Promise<Response> {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  if (!sameSite(request, host)) return NO_CONTENT();
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return NO_CONTENT();

  let payload;
  try {
    payload = collectPayloadSchema.parse(JSON.parse(body));
  } catch {
    return NO_CONTENT();
  }

  const db = await getDb();
  const [settings, state] = await Promise.all([readSiteSettings(db), loadSiteState()]);
  if (
    settings.analytics.excludeStaff &&
    (await isStaffToken(getAuthSecret(), readCookie(request, GATE_COOKIE_NAME), state))
  ) {
    return NO_CONTENT();
  }

  await recordPageView(db, {
    payload,
    headers: request.headers,
    ip: getClientIp(request.headers),
    host,
    supportedLocales: state.supportedLocales,
    defaultLocale: state.defaultLocale,
  });
  // Rollups / cleanup run lazily (throttled to once an hour) after the response.
  after(() => runMaintenance(db).then(() => undefined));
  return NO_CONTENT();
}
