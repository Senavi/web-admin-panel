/**
 * Matches a locale-less path against known route patterns:
 * exact paths (`/about`), named segments (`/blog/:slug`) and a trailing wildcard (`/docs/*`).
 */
export function matchesRoute(path: string, pattern: string): boolean {
  const pathParts = path.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  for (let i = 0; i < patternParts.length; i += 1) {
    const part = patternParts[i];
    if (part === '*') return pathParts.length >= i;
    const actual = pathParts[i];
    if (actual === undefined) return false;
    if (part?.startsWith(':')) continue;
    if (part !== actual) return false;
  }
  return pathParts.length === patternParts.length;
}

export function isKnownRoute(path: string, patterns: readonly string[]): boolean {
  const normalized = path.replace(/\/+$/, '') || '/';
  return patterns.some((pattern) => matchesRoute(normalized, pattern));
}
