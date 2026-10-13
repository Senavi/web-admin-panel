import fs from 'node:fs/promises';

import { seedAssetFile } from '@/core/preview/seed-data';

const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
  gif: 'image/gif',
};

/**
 * Seed images from `src/content/seed/assets` (bundled with the build). Used by
 * preview mode, where there is no media storage yet; `next/image` optimizes
 * them like uploads. Only plain file names from that folder are served.
 */
export async function GET(_request: Request, context: RouteContext<'/api/seed-assets/[name]'>) {
  const { name } = await context.params;
  const file = seedAssetFile(name);
  const type = CONTENT_TYPES[name.split('.').pop()?.toLowerCase() ?? ''];
  const bytes =
    file && type ? await fs.readFile(/*turbopackIgnore: true*/ file).catch(() => null) : null;
  if (!bytes || !type) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
