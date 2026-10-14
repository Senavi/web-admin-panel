import { projectConfig } from '../../project.config';

import { registry } from '@/content';
import { SESSION_COOKIE_NAMES } from '@/core/auth/cookies';
import { AdminRoute } from '@/core/project/paths';

import { waitForPort } from './process';

/**
 * `next dev` compiles a route on its first request. Requests the main routes
 * once in the background (one at a time, so the server stays responsive): the
 * site's pages, the admin login and the main admin screens. Admin screens are
 * requested with a placeholder session cookie: the proxy lets them through, the
 * page compiles and then redirects to the login (no data).
 */
export async function warmUpDevRoutes(port: number): Promise<void> {
  await waitForPort(port, 120_000);
  const base = `http://localhost:${port}`;
  const admin = projectConfig.adminPath;
  const staff = { cookie: `${SESSION_COOKIE_NAMES[0]}=warm-up` };
  const adminScreens = [
    AdminRoute.Overview,
    AdminRoute.Pages,
    `${AdminRoute.Pages}/${registry.pages[0]?.id ?? ''}`,
    AdminRoute.Managers,
    AdminRoute.Settings,
    AdminRoute.Security,
    AdminRoute.Account,
  ];
  const routes: Array<[string, Record<string, string>]> = [
    ['/', {}],
    [`${admin}${AdminRoute.Login}`, {}],
    ...adminScreens.map((path): [string, Record<string, string>] => [`${admin}${path}`, staff]),
    ...registry.pages.map((page): [string, Record<string, string>] => [page.path, {}]),
  ];
  for (const [path, headers] of routes) {
    await fetch(`${base}${path}`, { headers, redirect: 'manual' }).catch(() => undefined);
  }
  console.info(
    `[dev] Ready: ${base} (admin: ${base}${admin}). The first visit to a page compiles it; for real speed use \`pnpm preview\`.`,
  );
}
