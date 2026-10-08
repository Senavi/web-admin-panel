import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { recordPageView } from '@/core/analytics/collect';
import { countryFromHeaders } from '@/core/analytics/geo';
import { runAnalyticsMaintenance } from '@/core/analytics/maintenance';
import { getOverview } from '@/core/analytics/queries';
import { percentChange } from '@/core/analytics/range';
import { addDays, utcDay } from '@/core/analytics/time';
import { browserName, deviceType } from '@/core/analytics/user-agent';
import { analyticsEvents, analyticsSalts } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { runSeed } from '@/core/db/seed';

import { createTestDb } from '../support/db';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Safari/537.36';

describe('user agent and geo', () => {
  it('classifies devices and browsers', () => {
    expect(deviceType(IPHONE)).toBe('mobile');
    expect(deviceType(MAC_CHROME)).toBe('desktop');
    expect(deviceType('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')).toBe('tablet');
    expect(browserName(IPHONE)).toBe('Safari');
    expect(browserName(MAC_CHROME)).toBe('Chrome');
    expect(browserName('Mozilla/5.0 Edg/150')).toBe('Edge');
  });

  it('reads the country from platform headers only', () => {
    expect(countryFromHeaders(new Headers({ 'x-vercel-ip-country': 'ua' }))).toBe('UA');
    const netlify = Buffer.from(JSON.stringify({ country: { code: 'DE' } })).toString('base64');
    expect(countryFromHeaders(new Headers({ 'x-nf-geo': netlify }))).toBe('DE');
    expect(countryFromHeaders(new Headers())).toBeNull();
  });

  it('computes percent change', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(5, 0)).toBeNull();
  });
});

describe('collection, rollups and retention', () => {
  let db: Database;
  let close: () => Promise<void>;
  beforeAll(async () => {
    ({ db, close } = await createTestDb());
    await runSeed(db, { seedDevAdmin: false });
  });
  afterAll(() => close());

  const view = (path: string, ip: string, userAgent = MAC_CHROME, referrer?: string) =>
    recordPageView(db, {
      payload: { p: path, r: referrer },
      headers: new Headers({ 'user-agent': userAgent }),
      ip,
      host: 'example.com',
      supportedLocales: ['en', 'uk'],
      defaultLocale: 'en',
    });

  it('records humans, hashes visitors without storing IPs, ignores bots and prefetches', async () => {
    expect(await view('/', '1.1.1.1', MAC_CHROME, 'https://www.google.com/search?q=x')).toBe(
      'recorded',
    );
    expect(await view('/uk/about', '1.1.1.1')).toBe('recorded');
    expect(await view('/about', '2.2.2.2', IPHONE)).toBe('recorded');
    expect(await view('/', '3.3.3.3', 'Googlebot/2.1')).toBe('ignored');
    expect(
      await recordPageView(db, {
        payload: { p: '/' },
        headers: new Headers({ 'user-agent': MAC_CHROME, 'sec-purpose': 'prefetch' }),
        ip: '4.4.4.4',
        host: 'example.com',
        supportedLocales: ['en', 'uk'],
        defaultLocale: 'en',
      }),
    ).toBe('ignored');

    const rows = await db.select().from(analyticsEvents);
    expect(rows).toHaveLength(3);
    expect(JSON.stringify(rows)).not.toContain('1.1.1.1');
    expect(rows.find((row) => row.path === '/uk/about')).toMatchObject({
      pageId: 'about',
      locale: 'uk',
    });
    expect(rows.find((row) => row.path === '/')?.referrerHost).toBe('google.com');
  });

  it('reports today live, rolls up past days and keeps totals consistent', async () => {
    const today = await getOverview(db, 'today');
    expect(today.current).toMatchObject({ views: 3, visitors: 2, pagesPerVisit: 1.5 });
    expect(today.breakdowns.device.map((row) => row.value).sort()).toEqual(['desktop', 'mobile']);

    // Move the events to yesterday, then roll up.
    const yesterday = new Date(`${addDays(utcDay(), -1)}T12:00:00Z`);
    await db.update(analyticsEvents).set({ ts: yesterday });
    const summary = await runAnalyticsMaintenance(db, { force: true });
    expect(summary.rolledUp).toContain(utcDay(yesterday));
    const week = await getOverview(db, '7d');
    expect(week.current).toMatchObject({ views: 3, visitors: 2 });
    expect(week.series.find((point) => point.day === utcDay(yesterday))).toMatchObject({
      views: 3,
      visitors: 2,
    });
  });

  it('deletes events past the retention period and old salts', async () => {
    await db.insert(analyticsSalts).values({ day: '2000-01-01', salt: 'old' });
    await db.update(analyticsEvents).set({ ts: new Date('2001-01-01T00:00:00Z') });
    const summary = await runAnalyticsMaintenance(db, { force: true });
    expect(summary.deletedEvents).toBe(3);
    // Only today's salt remains; past salts are gone, so old hashes can never be recomputed.
    expect((await db.select().from(analyticsSalts)).map((row) => row.day)).toEqual([utcDay()]);
  });

  it('throttles lazy runs', async () => {
    expect((await runAnalyticsMaintenance(db)).skipped).toBe(true);
  });
});
