import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Database } from '@/core/db/types';
import { detectImageType, ImageType } from '@/core/media/detect';
import { IMAGE_LIMITS, ingestImage, ingestLogo, UploadError } from '@/core/media/ingest';
import type { StorageAdapter } from '@/core/storage/types';

import { createTestDb } from '../support/db';

function memoryStorage(): StorageAdapter & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    driver: 'local',
    location: 'memory',
    put: async (key, body) => void files.set(key, body),
    get: async (key) => {
      const body = files.get(key);
      return body ? { body: new Uint8Array(body), contentType: 'image/webp' } : null;
    },
    delete: async (key) => void files.delete(key),
    publicUrl: (key) => `/media/${key}`,
    check: async () => ({ ok: true }),
  };
}

const input = (bytes: Uint8Array, originalName = 'file.png') => ({
  bytes,
  originalName,
  uploadedBy: null,
});

describe('upload validation', () => {
  let db: Database;
  let close: () => Promise<void>;
  const storage = memoryStorage();
  beforeAll(async () => {
    ({ db, close } = await createTestDb());
  });
  afterAll(() => close());

  it('detects types by magic bytes, not names', async () => {
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#f00' } })
      .png()
      .toBuffer();
    expect(detectImageType(new Uint8Array(png))).toBe(ImageType.Png);
    expect(detectImageType(new TextEncoder().encode('<?php echo 1; ?>'))).toBeNull();
  });

  it('rejects non-images disguised as images, SVG in content fields, tiny and huge files', async () => {
    await expect(
      ingestImage(db, storage, input(new TextEncoder().encode('not an image'), 'evil.png')),
    ).rejects.toBeInstanceOf(UploadError);
    await expect(
      ingestImage(
        db,
        storage,
        input(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'x.svg'),
      ),
    ).rejects.toThrow(/Unsupported file/);
    const tiny = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } })
      .png()
      .toBuffer();
    await expect(ingestImage(db, storage, input(new Uint8Array(tiny)))).rejects.toThrow(/at least/);
    await expect(
      ingestImage(db, storage, input(new Uint8Array(IMAGE_LIMITS.maxBytes + 1))),
    ).rejects.toThrow(/smaller than/);
  });

  it('re-encodes to WebP with a random key, strips metadata and limits dimensions', async () => {
    const jpeg = await sharp({
      create: { width: 3000, height: 1000, channels: 3, background: '#0af' },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'secret-gps-owner' } } })
      .toBuffer();
    const row = await ingestImage(db, storage, input(new Uint8Array(jpeg), 'photo.jpg'));
    expect(row.mime).toBe('image/webp');
    expect(row.storageKey).toMatch(/^images\/[0-9a-f-]{36}\.webp$/);
    expect(row.width).toBe(IMAGE_LIMITS.maxDimension);
    const stored = storage.files.get(row.storageKey);
    const metadata = await sharp(Buffer.from(stored ?? new Uint8Array())).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(row.placeholder).toMatch(/^data:image\/webp;base64,/);
  });

  it('accepts sanitized SVG only for logos', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect width="120" height="40" fill="#123"/><script>alert(1)</script></svg>';
    const row = await ingestLogo(db, storage, input(new TextEncoder().encode(svg), 'logo.svg'));
    expect(row.mime).toBe('image/svg+xml');
    expect(new TextDecoder().decode(storage.files.get(row.storageKey))).not.toContain('script');
  });
});
