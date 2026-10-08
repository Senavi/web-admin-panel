import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Site UI strings: project-owned request config (src/site/i18n/request.ts).
const withNextIntl = createNextIntlPlugin('./src/site/i18n/request.ts');

function supabaseImagePatterns(): NonNullable<NonNullable<NextConfig['images']>['remotePatterns']> {
  const url = process.env.SUPABASE_URL;
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
    localPatterns: [{ pathname: '/api/media/**' }],
    remotePatterns: supabaseImagePatterns(),
  },
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
