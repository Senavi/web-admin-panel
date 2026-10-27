import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Minimal S3 test double (path-style, like Neon): PUT/GET/DELETE objects and
 * ListObjectsV2 with pagination. Rejects requests without a SigV4 Authorization
 * header; records every request for assertions.
 */
export interface S3TestServer {
  readonly endpoint: string;
  readonly objects: Map<string, { body: Buffer; contentType: string; cacheControl?: string }>;
  readonly requests: Array<{ method: string; path: string; authorization?: string }>;
  close(): Promise<void>;
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function startS3TestServer(bucket: string, pageSize = 2): Promise<S3TestServer> {
  const objects: S3TestServer['objects'] = new Map();
  const requests: S3TestServer['requests'] = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    requests.push({
      method: request.method ?? '',
      path: url.pathname,
      authorization: request.headers.authorization,
    });
    if (!request.headers.authorization?.startsWith('AWS4-HMAC-SHA256 ')) {
      response.writeHead(403).end('<Error><Code>AccessDenied</Code></Error>');
      return;
    }
    const [, bucketName, ...rest] = url.pathname.split('/');
    if (bucketName !== bucket) {
      response.writeHead(404).end('<Error><Code>NoSuchBucket</Code></Error>');
      return;
    }
    const key = rest.map(decodeURIComponent).join('/');
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      if (!key && request.method === 'GET' && url.searchParams.get('list-type') === '2') {
        const prefix = url.searchParams.get('prefix') ?? '';
        const max = Math.min(Number(url.searchParams.get('max-keys') ?? 1000), pageSize);
        const all = [...objects.keys()].filter((name) => name.startsWith(prefix)).sort();
        const start = Number(url.searchParams.get('continuation-token') ?? 0);
        const page = all.slice(start, start + max);
        const truncated = start + max < all.length;
        response
          .writeHead(200, { 'Content-Type': 'application/xml' })
          .end(
            `<?xml version="1.0"?><ListBucketResult><IsTruncated>${truncated}</IsTruncated>${page
              .map((name) => `<Contents><Key>${escape(name)}</Key></Contents>`)
              .join(
                '',
              )}${truncated ? `<NextContinuationToken>${start + max}</NextContinuationToken>` : ''}</ListBucketResult>`,
          );
        return;
      }
      if (request.method === 'PUT') {
        objects.set(key, {
          body: Buffer.concat(chunks),
          contentType: request.headers['content-type'] ?? 'application/octet-stream',
          cacheControl: request.headers['cache-control'],
        });
        response.writeHead(200).end();
        return;
      }
      const object = objects.get(key);
      if (request.method === 'GET') {
        if (!object) response.writeHead(404).end('<Error><Code>NoSuchKey</Code></Error>');
        else response.writeHead(200, { 'Content-Type': object.contentType }).end(object.body);
        return;
      }
      if (request.method === 'DELETE') {
        objects.delete(key);
        response.writeHead(204).end();
        return;
      }
      response.writeHead(501).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    endpoint: `http://127.0.0.1:${port}`,
    objects,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
