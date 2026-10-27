import { AwsClient } from 'aws4fetch';

import {
  assertSafeKey,
  IMMUTABLE_CACHE_CONTROL,
  mediaRouteUrl,
  type StorageAdapter,
} from './types';

/**
 * S3-compatible storage (D-096): Neon Object Storage (path-style only, a bucket per
 * branch with copy-on-write branching), Cloudflare R2, Hetzner, AWS. Requests are
 * signed with SigV4 (`aws4fetch`, fetch-based, no AWS SDK). Files are served by
 * `/api/media/<key>` (security headers, sandbox CSP for SVG, immutable cache), or
 * raster images straight from `publicUrl` when the bucket is public.
 */
export interface S3StorageConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  /** Public base URL of the bucket (optional). */
  readonly publicUrl?: string;
  /** `<endpoint>/<bucket>/<key>` (Neon) instead of `<bucket>.<endpoint host>/<key>`. */
  readonly forcePathStyle: boolean;
}

const SVG_KEY = /\.svg$/i;
const LIST_PAGE_SIZE = 1000;

/** Encodes a key for a URL path (keeps `/`). */
function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

function xmlValues(xml: string, tag: string): string[] {
  const values: string[] = [];
  for (const match of xml.matchAll(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'g')))
    values.push(
      (match[1] ?? '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&'),
    );
  return values;
}

async function failure(action: string, response: Response): Promise<Error> {
  const body = await response.text().catch(() => '');
  const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1];
  return new Error(`S3 ${action} failed: ${response.status}${code ? ` ${code}` : ''}`);
}

export function createS3Storage(
  config: S3StorageConfig,
  fetchImpl: typeof fetch = fetch,
): StorageAdapter {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: config.region,
  });
  const endpoint = new URL(config.endpoint);
  const base = config.forcePathStyle
    ? `${endpoint.origin}${endpoint.pathname.replace(/\/$/, '')}/${config.bucket}`
    : `${endpoint.protocol}//${config.bucket}.${endpoint.host}${endpoint.pathname.replace(/\/$/, '')}`;
  const objectUrl = (key: string) => `${base}/${encodeKey(key)}`;
  const send = async (url: string, init: RequestInit) => {
    const request = await client.sign(url, init);
    return fetchImpl(request);
  };
  const publicBase = config.publicUrl?.replace(/\/$/, '');

  return {
    driver: 's3',
    location: `bucket "${config.bucket}" at ${endpoint.host}`,
    servedByRoute: true,
    async put(key, body, contentType) {
      assertSafeKey(key);
      const response = await send(objectUrl(key), {
        method: 'PUT',
        body: new Blob([new Uint8Array(body)]),
        headers: { 'Content-Type': contentType, 'Cache-Control': IMMUTABLE_CACHE_CONTROL },
      });
      if (!response.ok) throw await failure('upload', response);
    },
    async get(key) {
      assertSafeKey(key);
      const response = await send(objectUrl(key), { method: 'GET' });
      if (response.status === 404) return null;
      if (!response.ok) throw await failure('read', response);
      return {
        body: new Uint8Array(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      };
    },
    async delete(key) {
      assertSafeKey(key);
      const response = await send(objectUrl(key), { method: 'DELETE' });
      if (!response.ok && response.status !== 404) throw await failure('delete', response);
    },
    async list(prefix = '') {
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const query = new URLSearchParams({ 'list-type': '2', 'max-keys': String(LIST_PAGE_SIZE) });
        if (prefix) query.set('prefix', prefix);
        if (token) query.set('continuation-token', token);
        const response = await send(`${base}?${query}`, { method: 'GET' });
        if (!response.ok) throw await failure('list', response);
        const xml = await response.text();
        keys.push(...xmlValues(xml, 'Key'));
        token =
          xmlValues(xml, 'IsTruncated')[0] === 'true'
            ? xmlValues(xml, 'NextContinuationToken')[0]
            : undefined;
      } while (token);
      return keys;
    },
    // SVG logos always go through the media route (sandbox CSP).
    publicUrl: (key) =>
      publicBase && !SVG_KEY.test(key) ? `${publicBase}/${encodeKey(key)}` : mediaRouteUrl(key),
    async check() {
      try {
        const response = await send(`${base}?list-type=2&max-keys=1`, { method: 'GET' });
        if (response.ok) return { ok: true };
        return { ok: false, error: (await failure('check', response)).message };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Unreachable' };
      }
    },
  };
}
