import path from 'node:path';

/**
 * Pure logic behind `pnpm content:check`: every registered page has exactly one
 * route under `src/app/(site)/[locale]`, and every route that renders content
 * belongs to a registered page with a matching path.
 */

export const ROUTE_MARKER = /createPageRoute\(\s*['"]([\w-]+)['"]/;
export const IGNORE_MARKER = 'content-check: ignore';

export interface RouteFile {
  /** Path relative to the site app directory, e.g. `[locale]/about/team/page.tsx`. */
  readonly file: string;
  readonly source: string;
}

export interface RegisteredRoute {
  readonly id: string;
  readonly path: string;
}

/** `[locale]/about/(group)/team/page.tsx` → `/about/team`. */
export function routePathFromFile(file: string): string | null {
  const segments = path
    .dirname(file)
    .split(/[\\/]/)
    .filter((segment) => segment && segment !== '.');
  if (segments[0] !== '[locale]') return null;
  const urlSegments = segments.slice(1).filter((segment) => !/^\(.*\)$/.test(segment));
  return `/${urlSegments.join('/')}`;
}

export function checkRoutes(
  pages: readonly RegisteredRoute[],
  files: readonly RouteFile[],
): string[] {
  const problems: string[] = [];
  const routesByPage = new Map<string, string[]>();

  for (const { file, source } of files) {
    if (source.includes(IGNORE_MARKER)) continue;
    const routePath = routePathFromFile(file);
    const match = ROUTE_MARKER.exec(source);
    if (!routePath) {
      if (match) problems.push(`${file}: content routes must live under (site)/[locale].`);
      continue;
    }
    if (!match?.[1]) {
      problems.push(
        `${file}: renders a site route but does not use createPageRoute('<pageId>') (add "// ${IGNORE_MARKER}" if it has no managed content).`,
      );
      continue;
    }
    const pageId = match[1];
    const page = pages.find((candidate) => candidate.id === pageId);
    if (!page) {
      problems.push(`${file}: page "${pageId}" is not registered in src/content/index.ts.`);
      continue;
    }
    if (page.path !== routePath) {
      problems.push(
        `${file}: page "${pageId}" has path "${page.path}" but the route is "${routePath}".`,
      );
    }
    routesByPage.set(pageId, [...(routesByPage.get(pageId) ?? []), file]);
  }

  for (const page of pages) {
    const routes = routesByPage.get(page.id) ?? [];
    if (routes.length === 0) problems.push(`Page "${page.id}" (${page.path}) has no route file.`);
    if (routes.length > 1)
      problems.push(`Page "${page.id}" has several routes: ${routes.join(', ')}.`);
  }
  return problems;
}
