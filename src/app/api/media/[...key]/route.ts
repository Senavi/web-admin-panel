import { getStorage } from '@/core/storage';
import { assertSafeKey, IMMUTABLE_CACHE_CONTROL } from '@/core/storage/types';

/**
 * Serves stored files for drivers whose public URL is this route: local files,
 * S3-compatible storage (Neon, R2…) and the staging read fallback. With Supabase
 * Storage, images load from the public bucket URL instead. Keys are random and
 * immutable, so responses are cached for a year (the CDN answers repeat requests).
 * SVG logos keep their sandboxing CSP (next.config leaves this route alone).
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/media/[...key]'>,
): Promise<Response> {
  const { key: segments } = await params;
  const key = segments.join('/');
  try {
    assertSafeKey(key);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const storage = getStorage();
  if (!storage.servedByRoute) return new Response('Not found', { status: 404 });
  const file = await storage.get(key);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(new Blob([file.body]), {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
