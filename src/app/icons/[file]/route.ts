import { isFaviconFile } from '@/core/media/favicon';
import { loadIcon } from '@/core/media/icons';

/** PNG icons and Apple touch icon (`/icons/icon-32.png`, `/icons/apple-touch-icon.png`, …). */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/icons/[file]'>,
): Promise<Response> {
  const { file } = await params;
  if (!isFaviconFile(file) || file === 'favicon.ico')
    return new Response('Not found', { status: 404 });
  const icon = await loadIcon(file);
  return new Response(Buffer.from(icon.base64, 'base64'), {
    headers: {
      'Content-Type': icon.contentType,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
