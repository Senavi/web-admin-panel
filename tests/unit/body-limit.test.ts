import { describe, expect, it } from 'vitest';

import { parseFormData, readLimitedBody } from '@/core/http/body-limit';

const LIMIT = 16;

function streamed(text: string): Request {
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 4) controller.enqueue(bytes.slice(i, i + 4));
      controller.close();
    },
  });
  return new Request('http://localhost/api', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    duplex: 'half',
  } as RequestInit);
}

describe('readLimitedBody', () => {
  it('refuses a declared length over the limit without reading', async () => {
    const request = new Request('http://localhost/api', {
      method: 'POST',
      body: 'a=1',
      headers: { 'content-length': String(LIMIT + 1) },
    });
    expect(await readLimitedBody(request, LIMIT)).toBeNull();
  });

  it('stops a streamed body (no length header) once it passes the limit', async () => {
    expect(await readLimitedBody(streamed('a='.padEnd(LIMIT + 8, 'x')), LIMIT)).toBeNull();
  });

  it('returns small bodies, which parse as form data', async () => {
    const request = streamed('a=1&b=two');
    const body = await readLimitedBody(request, LIMIT);
    expect(body).not.toBeNull();
    const data = await parseFormData(request, body ?? new Uint8Array(new ArrayBuffer(0)));
    expect(data.get('b')).toBe('two');
  });
});
