import { getStorage } from '@/core/storage';
import { assertSafeKey } from '@/core/storage/types';

/**
 * Serves files from the local storage driver (development / self-hosting).
 * With Supabase Storage, images are loaded from the public bucket URL instead.
 * Keys are random and immutable, so responses are cached for a year.
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
  if (storage.driver !== 'local') return new Response('Not found', { status: 404 });
  const file = await storage.get(key);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(new Blob([file.body]), {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
