// content-check: ignore (generated share image)
import { ImageResponse } from 'next/og';

import { getOgImageData } from '@/core/seo/og-data';
import { OG_IMAGE_SIZE } from '@/core/seo/page-metadata';
import { OgTemplate } from '@/site/theme/og-image';

/** `/og/{locale}/{pageId}.png`: generated default Open Graph image. */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/og/[locale]/[image]'>,
): Promise<Response> {
  const { locale, image } = await params;
  const pageId = image.replace(/\.png$/, '');
  const data = await getOgImageData(pageId, locale);
  if (!data) return new Response('Not found', { status: 404 });
  return new ImageResponse(<OgTemplate {...data} />, {
    ...OG_IMAGE_SIZE,
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
  });
}
