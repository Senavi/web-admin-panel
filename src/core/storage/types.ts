/** Storage adapter contract: local filesystem in development, Supabase Storage in production. */
export interface StorageAdapter {
  readonly driver: 'local' | 'supabase';
  /** Bucket / directory description for the Security page. */
  readonly location: string;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array<ArrayBuffer>; contentType: string } | null>;
  delete(key: string): Promise<void>;
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
