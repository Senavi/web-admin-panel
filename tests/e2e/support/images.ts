import sharp from 'sharp';

/** A small PNG generated on the fly for upload tests. */
export async function testPng(
  color: string,
  size = 64,
): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const buffer = await sharp({
    create: { width: size, height: size, channels: 3, background: color },
  })
    .png()
    .toBuffer();
  return { name: `test-${color.replace('#', '')}.png`, mimeType: 'image/png', buffer };
}
