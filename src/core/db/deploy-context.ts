/**
 * Decides whether a deploy build may run migrations. Preview deploys must
 * never migrate the production database before the change is merged.
 */
export type MigrationDecision =
  | { readonly migrate: true; readonly reason: string }
  | { readonly migrate: false; readonly reason: string };

export function migrationDecision(env: Record<string, string | undefined>): MigrationDecision {
  const vercel = env.VERCEL_ENV;
  const netlify = env.NETLIFY === 'true' ? env.CONTEXT : undefined;
  const platform = vercel ? `Vercel (${vercel})` : netlify ? `Netlify (${netlify})` : null;

  if (!platform) return { migrate: true, reason: 'not a platform build (local / CI)' };
  if (vercel === 'production' || netlify === 'production')
    return { migrate: true, reason: `${platform} production deploy` };
  if (env.PREVIEW_DATABASE_ISOLATED === 'true') {
    return {
      migrate: true,
      reason: `${platform}: PREVIEW_DATABASE_ISOLATED=true (preview has its own database)`,
    };
  }
  return {
    migrate: false,
    reason: `${platform}: skipped. Previews must not migrate the production database; give previews their own database and set PREVIEW_DATABASE_ISOLATED=true to migrate it.`,
  };
}
