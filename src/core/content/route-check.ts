import path from 'node:path';

/**
 * Pure logic behind `pnpm content:check`: every registered page and every
 * collection item route has exactly one route under `src/app/(site)/[locale]`,
 * and every route that renders content belongs to a registered page or
 * collection with a matching path. Globals and forms have no routes.
 */

/** Page routes: `createPageRoute('<pageId>'` or `createCollectionListRoute('<pageId>'`. */
export const ROUTE_MARKER = /create(?:Page|CollectionList)Route\(\s*['"]([\w-]+)['"]/;
/** Collection item routes: `createCollectionItemRoute('<collectionId>'`. */
export const ITEM_ROUTE_MARKER = /createCollectionItemRoute\(\s*['"]([\w-]+)['"]/;
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

export interface RegisteredCollectionRoute {
  readonly id: string;
  /** `/blog/:slug` */
  readonly itemPath: string;
}

/** `[locale]/about/(group)/team/page.tsx` → `/about/team`; `[slug]` → `:slug`. */
export function routePathFromFile(file: string): string | null {
  const segments = path
    .dirname(file)
    .split(/[\\/]/)
    .filter((segment) => segment && segment !== '.');
  if (segments[0] !== '[locale]') return null;
  const urlSegments = segments
    .slice(1)
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .map((segment) => segment.replace(/^\[(\w+)\]$/, ':$1'));
  return `/${urlSegments.join('/')}`;
}

export function checkRoutes(
  pages: readonly RegisteredRoute[],
  files: readonly RouteFile[],
  collections: readonly RegisteredCollectionRoute[] = [],
): string[] {
  const problems: string[] = [];
  const routesByPage = new Map<string, string[]>();
  const routesByCollection = new Map<string, string[]>();

  for (const { file, source } of files) {
    if (source.includes(IGNORE_MARKER)) continue;
    const routePath = routePathFromFile(file);
    const itemMatch = ITEM_ROUTE_MARKER.exec(source);
    if (itemMatch?.[1] && routePath) {
      const collectionId = itemMatch[1];
      const collection = collections.find((candidate) => candidate.id === collectionId);
      if (!collection) {
        problems.push(
          `${file}: collection "${collectionId}" is not registered in src/content/index.ts.`,
        );
      } else if (collection.itemPath !== routePath) {
        problems.push(
          `${file}: collection "${collectionId}" has itemPath "${collection.itemPath}" but the route is "${routePath}".`,
        );
      }
      routesByCollection.set(collectionId, [...(routesByCollection.get(collectionId) ?? []), file]);
      continue;
    }
    const match = ROUTE_MARKER.exec(source);
    if (!routePath) {
      if (match) problems.push(`${file}: content routes must live under (site)/[locale].`);
      continue;
    }
    if (!match?.[1]) {
      problems.push(
        `${file}: renders a site route but does not use createPageRoute('<pageId>') or createCollectionItemRoute('<collectionId>') (add "// ${IGNORE_MARKER}" if it has no managed content).`,
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
  for (const collection of collections) {
    const routes = routesByCollection.get(collection.id) ?? [];
    if (routes.length === 0) {
      problems.push(
        `Collection "${collection.id}" (${collection.itemPath}) has no item route (createCollectionItemRoute).`,
      );
    }
    if (routes.length > 1)
      problems.push(`Collection "${collection.id}" has several item routes: ${routes.join(', ')}.`);
  }
  return problems;
}
