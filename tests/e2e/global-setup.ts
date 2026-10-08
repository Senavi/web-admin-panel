import { request, type FullConfig } from '@playwright/test';

/**
 * Warms up the server (first compilation in `next dev` can take many seconds)
 * so individual tests don't hit cold-start timeouts.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  const context = await request.newContext({
    baseURL,
    extraHTTPHeaders: { 'user-agent': 'Mozilla/5.0 Chrome/150' },
  });
  for (const path of [
    '/',
    '/about',
    '/uk/about/team',
    '/admin/login',
    '/admin/account',
    '/access',
    '/nope',
    '/sitemap.xml',
  ]) {
    await context.get(path, { timeout: 120_000, maxRedirects: 0 }).catch(() => undefined);
  }
  await context.dispose();
}
