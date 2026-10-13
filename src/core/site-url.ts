/**
 * The site's public origin, without a trailing slash. Order:
 * `NEXT_PUBLIC_SITE_URL` → Netlify (`URL`; `DEPLOY_PRIME_URL` for deploy
 * previews and branch deploys) → Vercel (`VERCEL_PROJECT_PRODUCTION_URL`;
 * `VERCEL_URL` for previews) → null. Read at runtime, so the first deploy works
 * before anyone knows the address. Pure (no `server-only`): the env schema and
 * scripts use it too.
 */
export function resolveSiteUrl(
  source: Record<string, string | undefined> = process.env,
): string | null {
  const value = (name: string) => source[name]?.trim() || undefined;
  const explicit = value('NEXT_PUBLIC_SITE_URL');
  if (explicit) return normalize(explicit);

  if (value('NETLIFY') === 'true' || value('URL') || value('DEPLOY_PRIME_URL')) {
    const production = !value('CONTEXT') || value('CONTEXT') === 'production';
    const netlify = production
      ? (value('URL') ?? value('DEPLOY_PRIME_URL'))
      : (value('DEPLOY_PRIME_URL') ?? value('URL'));
    if (netlify) return normalize(netlify);
  }

  const vercelProduction = value('VERCEL_PROJECT_PRODUCTION_URL');
  const vercelDeployment = value('VERCEL_URL');
  const vercel =
    value('VERCEL_ENV') === 'production' || !vercelDeployment
      ? (vercelProduction ?? vercelDeployment)
      : vercelDeployment;
  return vercel ? normalize(vercel) : null;
}

/** Adds `https://` to bare hosts (Vercel variables have no scheme) and drops a trailing slash. */
function normalize(url: string): string {
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return withScheme.replace(/\/+$/, '');
}
