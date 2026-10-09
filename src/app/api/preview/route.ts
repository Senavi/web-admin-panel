import { cookies, draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { can, Permission } from '@/core/auth/permissions';
import { getCurrentUser } from '@/core/auth/server/session';
import { DRAFT_MODE_COOKIE, draftCookieOptions } from '@/core/collections/gate';
import { findItem } from '@/core/collections/repository';
import { collectionItemPath } from '@/core/content/collection';
import { contentRegistry } from '@/core/content/project-registry';
import { getDb } from '@/core/db/client';
import { NO_STORE } from '@/core/http/headers';
import { localizedPath } from '@/core/i18n/routing';
import { readSiteSettings } from '@/core/settings/repository';

const querySchema = z.object({
  collection: z.string().min(1).max(64),
  item: z.uuid(),
  locale: z.string().min(2).max(16),
});

/**
 * Staff preview of a collection item (drafts included): enables Draft Mode for
 * a signed-in user who can view content, then redirects to the item's URL. The
 * target is built from the database, never from the query (no open redirect).
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, Permission.PagesView)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': NO_STORE } });
  }
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  const collection = parsed.success
    ? contentRegistry.collectionById(parsed.data.collection)
    : undefined;
  const db = await getDb();
  const item =
    parsed.success && collection ? await findItem(db, collection.id, parsed.data.item) : null;
  const { general } = await readSiteSettings(db);
  if (
    !parsed.success ||
    !collection ||
    !item ||
    !general.enabledLocales.includes(parsed.data.locale)
  ) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': NO_STORE } });
  }
  const location = localizedPath(
    collectionItemPath(collection, item.slug),
    parsed.data.locale,
    general.defaultLocale,
  );
  (await draftMode()).enable();
  // Scope the Draft Mode cookie to this item's URL: other pages (and link
  // prefetches from the preview) keep using the cache (docs/DECISIONS.md D-067).
  const cookieStore = await cookies();
  const value = cookieStore.get(DRAFT_MODE_COOKIE)?.value;
  if (value) cookieStore.set(DRAFT_MODE_COOKIE, value, draftCookieOptions(location));
  redirect(location);
}
