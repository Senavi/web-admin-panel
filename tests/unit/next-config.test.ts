import { describe, expect, it } from 'vitest';

import nextConfig from '../../next.config';

/**
 * GHSA-2464-fhr4-w9xw (Next.js ≤ 16.4.0): SVG through the Image Optimization API.
 * The optimizer must never accept SVG, and only serves our own media routes.
 */
describe('next.config images', () => {
  it('keeps SVG out of the image optimizer', () => {
    expect(nextConfig.images?.dangerouslyAllowSVG ?? false).toBe(false);
  });

  it('only optimizes local images from the media routes', () => {
    expect(nextConfig.images?.localPatterns?.map((pattern) => pattern.pathname)).toEqual([
      '/api/media/**',
      '/api/seed-assets/**',
    ]);
  });
});

describe('next.config headers', () => {
  it('leaves uploaded files to their own sandboxing CSP', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const pageCsp = rules.find((rule) =>
      rule.headers.some((header) => header.key === 'Content-Security-Policy'),
    );
    const pattern = new RegExp(`^${pageCsp!.source}$`);
    expect(pattern.test('/about')).toBe(true);
    expect(pattern.test('/api/media/logos/x.svg')).toBe(false);
  });
});
