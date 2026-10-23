import { login } from './support/auth';
import { expect, test } from './support/test';
import { E2E_ADMIN } from './support/users';

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect width="120" height="40" fill="#123"/></svg>';

/** GHSA-2464-fhr4-w9xw: uploaded SVGs are never processed by `/_next/image`. */
test('an uploaded SVG logo is served as-is and refused by the image optimizer', async ({
  page,
  baseURL,
}) => {
  await login(page, E2E_ADMIN);
  const upload = await page.request.post('/api/media?kind=logo', {
    headers: { origin: baseURL! },
    multipart: { file: { name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) } },
  });
  expect(upload.status()).toBe(200);
  const { src } = (await upload.json()) as { src: string };
  expect(src).toMatch(/\.svg$/);

  // Served directly, sandboxed, never sniffed.
  const direct = await page.request.get(src);
  expect(direct.status()).toBe(200);
  expect(direct.headers()['content-security-policy']).toContain('sandbox');
  expect(direct.headers()['x-content-type-options']).toBe('nosniff');

  // The optimizer refuses it.
  const optimized = await page.request.get(`/_next/image?url=${encodeURIComponent(src)}&w=64&q=75`);
  expect(optimized.status()).toBeGreaterThanOrEqual(400);
  expect(optimized.headers()['content-type'] ?? '').not.toContain('svg');

  // SVG is never accepted as a content image.
  const content = await page.request.post('/api/media', {
    headers: { origin: baseURL! },
    multipart: { file: { name: 'x.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) } },
  });
  expect(content.status()).toBe(422);
});
