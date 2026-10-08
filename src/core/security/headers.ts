/**
 * Security headers and Content-Security-Policy (docs/SECURITY.md § Headers).
 *
 * - Public site + /access: statically rendered, so no nonces. Next.js inlines
 *   its runtime bootstrap scripts, which requires 'unsafe-inline' for scripts;
 *   everything else is locked down (no framing, no plugins). Third-party
 *   origins come only from the validated `projectConfig.csp` sources. The site
 *   itself adds no inline scripts (JSON-LD is not executable).
 * - Admin: rendered per request, so it gets a nonce-based policy with
 *   'strict-dynamic' (set by the proxy).
 */

// Project CSP sources are passed in (`projectConfig.csp`): next.config loads this
// module outside the bundler, where the `@project/config` alias does not resolve.
import type { SiteCspSources } from '@/core/project/define';

const isDev = process.env.NODE_ENV !== 'production';

function storageOrigin(): string | null {
  const url = process.env.SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function serialize(directives: Record<string, readonly string[]>): string {
  return Object.entries(directives)
    .map(([name, values]) => (values.length > 0 ? `${name} ${values.join(' ')}` : name))
    .join('; ');
}

function baseDirectives(): Record<string, string[]> {
  const storage = storageOrigin();
  return {
    'default-src': ["'self'"],
    'img-src': ["'self'", 'data:', 'blob:', ...(storage ? [storage] : [])],
    'font-src': ["'self'", 'data:'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'connect-src': ["'self'", ...(isDev ? ['ws:', 'wss:'] : [])],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    ...(isDev ? {} : { 'upgrade-insecure-requests': [] }),
  };
}

const PROJECT_DIRECTIVES: Record<keyof SiteCspSources, string> = {
  scriptSrc: 'script-src',
  styleSrc: 'style-src',
  imgSrc: 'img-src',
  fontSrc: 'font-src',
  connectSrc: 'connect-src',
  frameSrc: 'frame-src',
  mediaSrc: 'media-src',
  formAction: 'form-action',
};

/** Appends the project's CSP sources; directives absent from the base start from 'self'. */
function withProjectSources(
  directives: Record<string, string[]>,
  project: SiteCspSources,
): Record<string, string[]> {
  const merged = { ...directives };
  for (const [key, directive] of Object.entries(PROJECT_DIRECTIVES) as Array<
    [keyof SiteCspSources, string]
  >) {
    const sources = project[key];
    if (!sources?.length) continue;
    merged[directive] = [...new Set([...(merged[directive] ?? ["'self'"]), ...sources])];
  }
  return merged;
}

/** CSP for statically rendered pages (site, /access), extended with `projectConfig.csp`. */
export function staticPageCsp(project: SiteCspSources): string {
  return serialize(
    withProjectSources(
      {
        ...baseDirectives(),
        'script-src': ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
      },
      project,
    ),
  );
}

/** CSP for dynamically rendered admin pages. */
export function adminCsp(nonce: string): string {
  return serialize({
    ...baseDirectives(),
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
  });
}

export function createNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

/** Headers sent with every response (next.config `headers()`). */
export function baseSecurityHeaders(): Array<{ key: string; value: string }> {
  return [
    ...(isDev
      ? []
      : [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ]),
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    },
  ];
}

export const CSP_HEADER = 'Content-Security-Policy';
export const NONCE_HEADER = 'x-nonce';
