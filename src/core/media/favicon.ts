import sharp from 'sharp';

/**
 * Favicon set generated from one uploaded square-ish image: PNG icons, Apple
 * touch icon and a multi-size ICO (PNG-compressed entries, supported by all
 * current browsers).
 */
export const FAVICON_FILES = {
  'icon-16.png': 16,
  'icon-32.png': 32,
  'icon-48.png': 48,
  'icon-192.png': 192,
  'icon-512.png': 512,
  'apple-touch-icon.png': 180,
} as const;
export type FaviconFile = keyof typeof FAVICON_FILES | 'favicon.ico';

const ICO_SIZES = [16, 32, 48] as const;

export function faviconKey(mediaId: string, file: FaviconFile): string {
  return `favicons/${mediaId}/${file}`;
}

export function isFaviconFile(name: string): name is FaviconFile {
  return name === 'favicon.ico' || name in FAVICON_FILES;
}

async function png(source: Uint8Array, size: number, background?: string): Promise<Buffer> {
  const image = sharp(source).resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  return (background ? image.flatten({ background }) : image).png().toBuffer();
}

/** ICO container with PNG entries. */
export function buildIco(images: ReadonlyArray<{ size: number; data: Buffer }>): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const entries: Buffer[] = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

export async function generateFavicons(
  source: Uint8Array,
  appleBackground: string,
): Promise<Map<FaviconFile, Buffer>> {
  const files = new Map<FaviconFile, Buffer>();
  for (const [name, size] of Object.entries(FAVICON_FILES) as Array<
    [keyof typeof FAVICON_FILES, number]
  >) {
    // Apple touch icons don't support transparency well: flatten onto the theme color.
    files.set(
      name,
      await png(source, size, name === 'apple-touch-icon.png' ? appleBackground : undefined),
    );
  }
  const icoImages = await Promise.all(
    ICO_SIZES.map(async (size) => ({ size, data: await png(source, size) })),
  );
  files.set('favicon.ico', buildIco(icoImages));
  return files;
}

/** Fallback icon: the site's initial on the theme color. */
export async function defaultIconSource(initial: string, themeColor: string): Promise<Buffer> {
  const letter =
    initial
      .replace(/[<>&"']/g, '')
      .slice(0, 1)
      .toUpperCase() || 'S';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="112" fill="${themeColor}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="300" font-weight="700" fill="#ffffff">${letter}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
