import 'server-only';

import { inArray } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';

import { CacheTag } from '@/core/cache/tags';
import type { ResolvedImage } from '@/core/content/define';
import type { ImageValue } from '@/core/content/fields';
import { getDb } from '@/core/db/client';
import { media } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { getStorage } from '@/core/storage';

export interface MediaInfo {
  readonly id: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly blurDataURL: string | null;
}

/** Loads media rows in one query and maps them to public URLs. */
export async function loadMedia(
  db: Database,
  ids: readonly string[],
): Promise<Map<string, MediaInfo>> {
  if (ids.length === 0) return new Map();
  const storage = getStorage();
  const rows = await db
    .select()
    .from(media)
    .where(inArray(media.id, [...ids]));
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        src: storage.publicUrl(row.storageKey),
        width: row.width ?? 0,
        height: row.height ?? 0,
        blurDataURL: row.placeholder,
      },
    ]),
  );
}

/** One media item by id, cached (used for Open Graph images in metadata). */
export async function getMediaInfo(mediaId: string): Promise<MediaInfo | null> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.media(mediaId));
  return (await loadMedia(await getDb(), [mediaId])).get(mediaId) ?? null;
}

export function toResolvedImage(
  value: ImageValue,
  mediaById: ReadonlyMap<string, MediaInfo>,
): ResolvedImage | null {
  const info = value.mediaId ? mediaById.get(value.mediaId) : undefined;
  return info ? { ...info, alt: value.alt } : null;
}

/** Media ids of seed assets already imported by `content:sync`. */
export async function seedAssetIds(
  db: Database,
  assets: readonly string[],
): Promise<Map<string, string>> {
  if (assets.length === 0) return new Map();
  const rows = await db
    .select({ id: media.id, seedAsset: media.seedAsset })
    .from(media)
    .where(inArray(media.seedAsset, [...assets]));
  return new Map(rows.flatMap((row) => (row.seedAsset ? [[row.seedAsset, row.id] as const] : [])));
}
