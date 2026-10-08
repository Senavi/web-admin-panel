/**
 * Runs once when a server instance starts. Validates the environment so a
 * misconfigured deployment fails fast with a readable error.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { env } = await import('@/core/env');
  env();
}
