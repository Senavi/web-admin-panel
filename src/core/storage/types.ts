/** Storage adapter contract: local files, Supabase Storage or any S3-compatible store. */
export type StorageDriverName = 'local' | 'supabase' | 's3';

export const STORAGE_DRIVER_LABELS: Record<StorageDriverName, string> = {
  local: 'Local folder',
  supabase: 'Supabase Storage',
  s3: 'S3-compatible storage',
};

export interface StorageAdapter {
  readonly driver: StorageDriverName;
  /** Bucket / directory description for the Security page. */
  readonly location: string;
  /**
   * True when browsers load files through `/api/media/<key>` (local, S3, read
   * fallback), so that route serves them; false when `publicUrl` points elsewhere.
   */
  readonly servedByRoute: boolean;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array<ArrayBuffer>; contentType: string } | null>;
  delete(key: string): Promise<void>;
  /** Keys under a prefix (database copy, storage usage). */
  list(prefix?: string): Promise<string[]>;
  /** URL the browser (and next/image) loads the object from. */
  publicUrl(key: string): string;
  /** Lightweight health check for the Security page. */
  check(): Promise<{ ok: true } | { ok: false; error: string }>;
}

/** Storage keys are generated server-side; this guards against path traversal anyway. */
export function assertSafeKey(key: string): void {
  if (!/^[a-z0-9][a-z0-9/_.-]*$/i.test(key) || key.includes('..') || key.startsWith('/')) {
    throw new Error(`Invalid storage key "${key}".`);
  }
}

export const MEDIA_ROUTE_PREFIX = '/api/media';

/** `/api/media/<key>`: the public URL of files served by the media route. */
export function mediaRouteUrl(key: string): string {
  return `${MEDIA_ROUTE_PREFIX}/${key}`;
}

/** Cache header of stored files: keys are random and never reused. */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
