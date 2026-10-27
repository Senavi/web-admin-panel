import { assertSafeKey, mediaRouteUrl, type StorageAdapter } from './types';

/**
 * Staging with a non-branching store (R2, Supabase): a copy of the production
 * database points to production files this environment's bucket doesn't have.
 * Reads that miss fall back to the production bucket's PUBLIC URL (read only by
 * construction: plain GET, no credentials); writes and deletes only ever touch
 * the primary store. Files are then served by `/api/media` (D-096).
 */
export function withReadFallback(
  primary: StorageAdapter,
  fallbackBaseUrl: string,
  fetchImpl: typeof fetch = fetch,
): StorageAdapter {
  const base = fallbackBaseUrl.replace(/\/$/, '');
  return {
    ...primary,
    location: `${primary.location} (reads missing files from ${new URL(base).host})`,
    servedByRoute: true,
    async get(key) {
      const own = await primary.get(key);
      if (own) return own;
      assertSafeKey(key);
      const response = await fetchImpl(`${base}/${key}`, { method: 'GET' });
      if (!response.ok) return null;
      return {
        body: new Uint8Array(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      };
    },
    publicUrl: (key) => mediaRouteUrl(key),
  };
}
