import 'server-only';

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '@/content';
import { analyticsEvents, analyticsSalts } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { isBotUserAgent } from '@/core/http/bots';
import { splitLocale } from '@/core/i18n/routing';
import { sha256Hex } from '@/core/security/crypto';

import { countryFromHeaders } from './geo';
import { utcDay } from './time';
import { browserName, deviceType } from './user-agent';

/** Payload sent by the beacon script (public/a.js). */
export const collectPayloadSchema = z.object({
  /** Path of the page view (no query string). */
  p: z.string().startsWith('/').max(512),
  /** document.referrer on the first view of a visit. */
  r: z.string().max(2048).optional(),
});

export type CollectResult = 'recorded' | 'ignored';

async function dailySalt(db: Database, day: string): Promise<string> {
  const [existing] = await db.select().from(analyticsSalts).where(eq(analyticsSalts.day, day));
  if (existing) return existing.salt;
  const salt = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  await db.insert(analyticsSalts).values({ day, salt }).onConflictDoNothing();
  const [row] = await db.select().from(analyticsSalts).where(eq(analyticsSalts.day, day));
  return row?.salt ?? salt;
}

function referrerHost(referrer: string | undefined, host: string): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.host === host) return null;
    return url.hostname.replace(/^www\./, '').slice(0, 255);
  } catch {
    return null;
  }
}

/**
 * Records one page view. No cookies and no raw IPs: the visitor hash is
 * SHA-256(daily salt + IP + user agent + host); the salt is deleted after the
 * day, so hashes can't be linked across days or reversed.
 */
export async function recordPageView(
  db: Database,
  input: {
    payload: z.infer<typeof collectPayloadSchema>;
    headers: Headers;
    ip: string | null;
    host: string;
    supportedLocales: readonly string[];
    defaultLocale: string;
  },
): Promise<CollectResult> {
  const userAgent = input.headers.get('user-agent') ?? '';
  const purpose = `${input.headers.get('sec-purpose') ?? ''} ${input.headers.get('purpose') ?? ''}`;
  if (isBotUserAgent(userAgent) || /prefetch|prerender/i.test(purpose)) return 'ignored';

  const now = new Date();
  const salt = await dailySalt(db, utcDay(now));
  const visitorHash = (
    await sha256Hex(`${salt}|${input.ip ?? ''}|${userAgent}|${input.host}`)
  ).slice(0, 32);
  const path = input.payload.p.split('?')[0]?.split('#')[0] ?? '/';
  const { locale, rest } = splitLocale(path, input.supportedLocales);
  const page = registry.byPath(rest);

  await db.insert(analyticsEvents).values({
    ts: now,
    path: path.slice(0, 512),
    pageId: page?.id ?? null,
    locale: locale ?? input.defaultLocale,
    visitorHash,
    referrerHost: referrerHost(input.payload.r, input.host),
    deviceType: deviceType(userAgent),
    browser: browserName(userAgent),
    country: countryFromHeaders(input.headers),
  });
  return 'recorded';
}
