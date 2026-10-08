/** Image types accepted for upload, detected from file signatures (magic bytes), never from the name. */
export const ImageType = {
  Jpeg: 'image/jpeg',
  Png: 'image/png',
  Webp: 'image/webp',
  Gif: 'image/gif',
  Avif: 'image/avif',
  Svg: 'image/svg+xml',
} as const;
export type ImageType = (typeof ImageType)[keyof typeof ImageType];

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return ImageType.Jpeg;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return ImageType.Png;
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return ImageType.Webp;
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return ImageType.Gif;
  if (ascii(bytes, 4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(bytes, 8, 12)))
    return ImageType.Avif;
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg')))
    return ImageType.Svg;
  return null;
}

export const RASTER_IMAGE_TYPES: readonly ImageType[] = [
  ImageType.Jpeg,
  ImageType.Png,
  ImageType.Webp,
  ImageType.Gif,
  ImageType.Avif,
];
