/**
 * Runs once when a server instance starts. Validates the environment so a
 * misconfigured deployment fails fast with a readable error, and says so when
 * the site runs in preview mode (no database).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { env } = await import('@/core/env');
  env();
  const { isPreviewMode, PREVIEW_MODE_LOG } = await import('@/core/preview/mode');
  if (isPreviewMode()) console.info(PREVIEW_MODE_LOG);
}
