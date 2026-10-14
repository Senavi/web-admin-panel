import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { projectConfig } from './project.config';
import { resolveSupabaseUrl } from './src/core/db/connection-info';
import { baseSecurityHeaders, CSP_HEADER, staticPageCsp } from './src/core/security/headers';

// Site UI strings: project-owned request config (src/site/i18n/request.ts).
const withNextIntl = createNextIntlPlugin('./src/site/i18n/request.ts');

function supabaseImagePatterns(): NonNullable<NonNullable<NextConfig['images']>['remotePatterns']> {
  // SUPABASE_URL, or derived from a Supabase DATABASE_URL.
  const url = resolveSupabaseUrl({
    SUPABASE_URL: process.env.SUPABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
  });
  if (!url) return [];
  const { protocol, hostname } = new URL(url);
  return [
    {
      protocol: protocol === 'http:' ? 'http' : 'https',
      hostname,
      pathname: '/storage/v1/object/public/**',
    },
  ];
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    // Local storage driver serves uploads from this route; Supabase hosts are added from env.
    // Preview mode (no database) serves the seed images from /api/seed-assets.
    localPatterns: [{ pathname: '/api/media/**' }, { pathname: '/api/seed-assets/**' }],
    remotePatterns: supabaseImagePatterns(),
  },
  async headers() {
    const admin = projectConfig.adminPath.slice(1);
    return [
      { source: '/:path*', headers: baseSecurityHeaders() },
      // Static pages: CSP without nonces. Admin pages get a nonce CSP from the proxy.
      {
        source: `/((?!${admin}(?:/|$)|_next/static|_next/image).*)`,
        headers: [{ key: CSP_HEADER, value: staticPageCsp(projectConfig.csp) }],
      },
    ];
  },
  // Separate output folder (e.g. the preview-mode e2e build) without touching `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Preview mode reads seed images at runtime (dimensions, /api/seed-assets).
  outputFileTracingIncludes: { '/**': ['./src/content/seed/assets/**'] },
  // PGlite ships WASM + data files that must be loaded from node_modules at runtime.
  serverExternalPackages: ['@electric-sql/pglite'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default withNextIntl(nextConfig);
