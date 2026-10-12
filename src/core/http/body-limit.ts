/** HTTP 413: the request body is larger than the endpoint accepts. */
export const PAYLOAD_TOO_LARGE = 413;

/**
 * Reads a request body up to `maxBytes`. Returns null as soon as the declared
 * length or the bytes actually received exceed the limit, so an oversized body
 * is never buffered or parsed in full.
 */
export async function readLimitedBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return new Uint8Array(new ArrayBuffer(0));
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(new ArrayBuffer(size));
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** Parses a size-checked body as form data (urlencoded or multipart). */
export async function parseFormData(
  request: Request,
  body: Uint8Array<ArrayBuffer>,
): Promise<FormData> {
  return new Response(body, {
    headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
  }).formData();
}
