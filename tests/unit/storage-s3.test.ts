import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resolveStorageDriver, StorageDriver } from '@/core/env-schema';
import { withReadFallback } from '@/core/storage/read-fallback';
import { createS3Storage } from '@/core/storage/s3';
import type { StorageAdapter } from '@/core/storage/types';

import { startS3TestServer, type S3TestServer } from '../support/s3-server';
import { memoryStorage } from '../support/storage';

const BUCKET = 'media';

describe('S3 storage adapter', () => {
  let server: S3TestServer;
  let storage: StorageAdapter;

  beforeAll(async () => {
    server = await startS3TestServer(BUCKET);
    storage = createS3Storage({
      endpoint: server.endpoint,
      region: 'us-east-2',
      bucket: BUCKET,
      accessKeyId: 'nak_live_test',
      secretAccessKey: 'nsk_live_test',
      forcePathStyle: true,
    });
  });
  afterAll(() => server.close());

  it('uploads with content type and an immutable cache header, signed with SigV4', async () => {
    await storage.put('images/a.webp', new Uint8Array([1, 2, 3]), 'image/webp');
    const stored = server.objects.get('images/a.webp');
    expect(stored?.contentType).toBe('image/webp');
    expect(stored?.cacheControl).toBe('public, max-age=31536000, immutable');
    const request = server.requests.at(-1);
    expect(request?.path).toBe('/media/images/a.webp');
    expect(request?.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=nak_live_test\/\d+\/us-east-2\/s3\//,
    );
  });

  it('reads, returns null for missing objects and deletes', async () => {
    const file = await storage.get('images/a.webp');
    expect(file?.contentType).toBe('image/webp');
    expect([...(file?.body ?? [])]).toEqual([1, 2, 3]);
    expect(await storage.get('images/missing.webp')).toBeNull();
    await storage.delete('images/a.webp');
    expect(server.objects.has('images/a.webp')).toBe(false);
    await expect(storage.delete('images/a.webp')).resolves.toBeUndefined();
  });

  it('lists every key under a prefix across pages', async () => {
    for (const name of ['logos/x.svg', 'images/1.webp', 'images/2.webp', 'images/3.webp'])
      await storage.put(name, new Uint8Array([0]), 'image/webp');
    expect(await storage.list('images/')).toEqual([
      'images/1.webp',
      'images/2.webp',
      'images/3.webp',
    ]);
    expect(await storage.list()).toHaveLength(4);
  });

  it('serves through /api/media; a public bucket serves raster images, never SVG', () => {
    expect(storage.servedByRoute).toBe(true);
    expect(storage.publicUrl('images/1.webp')).toBe('/api/media/images/1.webp');
    const publicBucket = createS3Storage({
      endpoint: server.endpoint,
      region: 'auto',
      bucket: BUCKET,
      accessKeyId: 'k',
      secretAccessKey: 's',
      forcePathStyle: true,
      publicUrl: 'https://cdn.example.com/media/',
    });
    expect(publicBucket.publicUrl('images/1.webp')).toBe(
      'https://cdn.example.com/media/images/1.webp',
    );
    expect(publicBucket.publicUrl('logos/x.svg')).toBe('/api/media/logos/x.svg');
  });

  it('rejects unsafe keys and reports health', async () => {
    await expect(storage.put('../etc/passwd', new Uint8Array(), 'text/plain')).rejects.toThrow();
    expect(await storage.check()).toEqual({ ok: true });
    const wrong = createS3Storage({
      endpoint: server.endpoint,
      region: 'auto',
      bucket: 'other',
      accessKeyId: 'k',
      secretAccessKey: 's',
      forcePathStyle: true,
    });
    expect(await wrong.check()).toMatchObject({ ok: false });
  });

  it('builds virtual-host URLs when path style is off (R2, AWS)', async () => {
    const urls: string[] = [];
    const virtual = createS3Storage(
      {
        endpoint: 'https://account.r2.cloudflarestorage.com',
        region: 'auto',
        bucket: 'media',
        accessKeyId: 'k',
        secretAccessKey: 's',
        forcePathStyle: false,
      },
      async (input) => {
        urls.push(input instanceof Request ? input.url : String(input));
        return new Response(null, { status: 404 });
      },
    );
    await virtual.get('images/a.webp');
    expect(urls).toEqual(['https://media.account.r2.cloudflarestorage.com/images/a.webp']);
  });
});

describe('read fallback (staging)', () => {
  it('reads missing files from the production URL and never writes or deletes there', async () => {
    const primary = memoryStorage();
    await primary.put('images/own.webp', new Uint8Array([9]), 'image/webp');
    const calls: Array<{ url: string; method: string }> = [];
    const storage = withReadFallback(
      primary,
      'https://prod.example.com/media/',
      async (input, init) => {
        calls.push({ url: String(input), method: init?.method ?? 'GET' });
        return new Response(new Uint8Array([7]), { headers: { 'content-type': 'image/webp' } });
      },
    );

    expect([...((await storage.get('images/own.webp'))?.body ?? [])]).toEqual([9]);
    expect(calls).toEqual([]);
    expect([...((await storage.get('images/prod.webp'))?.body ?? [])]).toEqual([7]);
    expect(calls).toEqual([
      { url: 'https://prod.example.com/media/images/prod.webp', method: 'GET' },
    ]);

    await storage.put('images/new.webp', new Uint8Array([1]), 'image/webp');
    await storage.delete('images/prod.webp');
    expect(calls.every((call) => call.method === 'GET')).toBe(true);
    expect(calls).toHaveLength(1);
    expect(primary.files.has('images/new.webp')).toBe(true);
    expect(storage.publicUrl('images/prod.webp')).toBe('/api/media/images/prod.webp');
    expect(storage.servedByRoute).toBe(true);
  });
});

describe('storage driver resolution', () => {
  const supabase =
    'postgresql://postgres.abcdefghijklmnopqrst:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';
  const neon = 'postgresql://u:p@ep-x-1-pooler.eu-central-1.aws.neon.tech/neondb';
  it('picks S3 when S3 variables are set, Supabase for a Supabase database, else local', () => {
    expect(
      resolveStorageDriver({ DATABASE_URL: neon, S3_ENDPOINT: 'https://x', S3_BUCKET: 'b' }),
    ).toBe(StorageDriver.S3);
    expect(resolveStorageDriver({ DATABASE_URL: supabase })).toBe(StorageDriver.Supabase);
    expect(resolveStorageDriver({ DATABASE_URL: supabase, S3_BUCKET: 'b' })).toBe(StorageDriver.S3);
    expect(resolveStorageDriver({ DATABASE_URL: neon })).toBe(StorageDriver.Local);
    expect(resolveStorageDriver({ STORAGE_DRIVER: StorageDriver.Local, S3_BUCKET: 'b' })).toBe(
      StorageDriver.Local,
    );
  });
});
