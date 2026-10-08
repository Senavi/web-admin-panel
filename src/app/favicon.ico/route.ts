import { loadIcon } from '@/core/media/icons';

/** /favicon.ico from Settings → Branding (or a generated default). */
export async function GET(): Promise<Response> {
  const icon = await loadIcon('favicon.ico');
  return new Response(Buffer.from(icon.base64, 'base64'), {
    headers: {
      'Content-Type': icon.contentType,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
