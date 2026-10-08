import 'server-only';

import sharp, { type Metadata, type Sharp } from 'sharp';

import { media } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import type { StorageAdapter } from '@/core/storage/types';

import { detectImageType, ImageType, RASTER_IMAGE_TYPES } from './detect';
import { faviconKey, generateFavicons } from './favicon';
import { sanitizeSvg, SvgRejectedError } from './svg';

/** Upload limits (docs/SECURITY.md § Uploads). */
export const IMAGE_LIMITS = {
  /** Serverless request bodies are limited (Vercel ~4.5 MB), so uploads are capped below that. */
  maxBytes: 4 * 1024 * 1024,
  /** Decompression-bomb guard. */
  maxInputPixels: 40_000_000,
  /** Longest edge after re-encoding. */
  maxDimension: 2560,
  minDimension: 16,
} as const;

const OUTPUT_TYPE = 'image/webp';
const OUTPUT_QUALITY = 82;
const PLACEHOLDER_WIDTH = 16;

export class UploadError extends Error {}

export interface IngestInput {
  readonly bytes: Uint8Array;
  readonly originalName: string;
  readonly uploadedBy: string | null;
  readonly kind?: 'image' | 'logo' | 'favicon';
  readonly seedAsset?: string;
}

export type MediaRow = typeof media.$inferSelect;

/**
 * Validates and stores an uploaded raster image: magic-byte type check, size and
 * dimension limits, auto-rotation, resize, re-encode to WebP (drops EXIF/GPS
 * metadata), random storage key and a tiny blur placeholder.
 */
export async function ingestImage(
  db: Database,
  storage: StorageAdapter,
  input: IngestInput,
): Promise<MediaRow> {
  if (input.bytes.byteLength === 0) throw new UploadError('The file is empty.');
  if (input.bytes.byteLength > IMAGE_LIMITS.maxBytes) {
    throw new UploadError(`Images must be smaller than ${IMAGE_LIMITS.maxBytes / 1024 / 1024} MB.`);
  }
  const type = detectImageType(input.bytes);
  if (!type || !RASTER_IMAGE_TYPES.includes(type)) {
    throw new UploadError('Unsupported file. Upload a JPEG, PNG, WebP, GIF or AVIF image.');
  }

  let pipeline: Sharp;
  let metadata: Metadata;
  try {
    pipeline = sharp(input.bytes, {
      limitInputPixels: IMAGE_LIMITS.maxInputPixels,
      failOn: 'error',
    });
    metadata = await pipeline.metadata();
  } catch {
    throw new UploadError('The image could not be read. It may be corrupted or too large.');
  }
  if (
    (metadata.width ?? 0) < IMAGE_LIMITS.minDimension ||
    (metadata.height ?? 0) < IMAGE_LIMITS.minDimension
  ) {
    throw new UploadError(
      `Images must be at least ${IMAGE_LIMITS.minDimension}×${IMAGE_LIMITS.minDimension} pixels.`,
    );
  }

  const { data, info } = await pipeline
    .rotate()
    .resize({
      width: IMAGE_LIMITS.maxDimension,
      height: IMAGE_LIMITS.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: OUTPUT_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const placeholder = await sharp(data)
    .resize({ width: PLACEHOLDER_WIDTH })
    .webp({ quality: 40 })
    .toBuffer();
  const key = `images/${crypto.randomUUID()}.webp`;
  await storage.put(key, new Uint8Array(data), OUTPUT_TYPE);

  const [row] = await db
    .insert(media)
    .values({
      kind: input.kind ?? 'image',
      storageKey: key,
      mime: OUTPUT_TYPE,
      size: info.size,
      width: info.width,
      height: info.height,
      placeholder: `data:image/webp;base64,${placeholder.toString('base64')}`,
      originalName: input.originalName.slice(0, 200),
      uploadedBy: input.uploadedBy,
      seedAsset: input.seedAsset ?? null,
    })
    .returning();
  if (!row) throw new Error('Failed to save media record.');
  return row;
}

/** Logos may be SVG (sanitized and stored as-is) or raster (normal pipeline). */
export async function ingestLogo(
  db: Database,
  storage: StorageAdapter,
  input: Omit<IngestInput, 'kind'>,
): Promise<MediaRow> {
  if (detectImageType(input.bytes) !== ImageType.Svg)
    return ingestImage(db, storage, { ...input, kind: 'logo' });
  let svg: string;
  try {
    svg = sanitizeSvg(new TextDecoder().decode(input.bytes));
  } catch (error) {
    throw new UploadError(error instanceof SvgRejectedError ? error.message : 'Invalid SVG.');
  }
  const bytes = new TextEncoder().encode(svg);
  const metadata = await sharp(Buffer.from(bytes))
    .metadata()
    .catch(() => null);
  const key = `logos/${crypto.randomUUID()}.svg`;
  await storage.put(key, bytes, ImageType.Svg);
  const [row] = await db
    .insert(media)
    .values({
      kind: 'logo',
      storageKey: key,
      mime: ImageType.Svg,
      size: bytes.byteLength,
      width: metadata?.width ?? null,
      height: metadata?.height ?? null,
      originalName: input.originalName.slice(0, 200),
      uploadedBy: input.uploadedBy,
    })
    .returning();
  if (!row) throw new Error('Failed to save media record.');
  return row;
}

/** Favicon: raster pipeline for the preview + generated icon set next to it. */
export async function ingestFavicon(
  db: Database,
  storage: StorageAdapter,
  input: Omit<IngestInput, 'kind'>,
  appleBackground: string,
): Promise<MediaRow> {
  const row = await ingestImage(db, storage, { ...input, kind: 'favicon' });
  const files = await generateFavicons(input.bytes, appleBackground);
  await Promise.all(
    [...files].map(([name, data]) =>
      storage.put(
        faviconKey(row.id, name),
        new Uint8Array(data),
        name.endsWith('.ico') ? 'image/x-icon' : 'image/png',
      ),
    ),
  );
  return row;
}
