import 'server-only';

import { cache } from 'react';

import { getDb } from '@/core/db/client';
import { timed } from '@/core/perf/timing';

import { readSiteSettings } from './repository';
import type { SiteSettings } from './schema';

/**
 * Settings for the admin, read from the database once per request (the layout,
 * the session guard and the page share it). Uncached across requests.
 */
export const getRequestSettings = cache((): Promise<SiteSettings> =>
  timed('db:settings', async () => readSiteSettings(await getDb())),
);
