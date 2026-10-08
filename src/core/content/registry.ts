import type { AnyPage } from './define';

/**
 * Page registry: the project's fixed set of pages (`src/content/index.ts`).
 * Validates ids, paths and parents once at startup and provides lookups and
 * the page tree used by the admin.
 */

export interface PageTreeNode {
  readonly page: AnyPage;
  readonly children: readonly PageTreeNode[];
}

export interface PageRegistry<P extends readonly AnyPage[] = readonly AnyPage[]> {
  readonly pages: P;
  readonly ids: readonly P[number]['id'][];
  byId(id: string): P[number] | undefined;
  byPath(path: string): P[number] | undefined;
  tree(): PageTreeNode[];
}

export function createRegistry<const P extends readonly AnyPage[]>(pages: P): PageRegistry<P> {
  const byId = new Map<string, P[number]>();
  const byPath = new Map<string, P[number]>();
  for (const page of pages) {
    if (byId.has(page.id)) throw new Error(`Duplicate page id "${page.id}".`);
    if (byPath.has(page.path)) throw new Error(`Duplicate page path "${page.path}".`);
    byId.set(page.id, page);
    byPath.set(page.path, page);
  }
  for (const page of pages) {
    if (page.parent !== null && !byId.has(page.parent)) {
      throw new Error(`Page "${page.id}" has unknown parent "${page.parent}".`);
    }
    // Detect cycles.
    const seen = new Set<string>([page.id]);
    let parent = page.parent;
    while (parent !== null) {
      if (seen.has(parent)) throw new Error(`Page parent cycle involving "${page.id}".`);
      seen.add(parent);
      parent = byId.get(parent)?.parent ?? null;
    }
  }

  const buildTree = (parent: string | null): PageTreeNode[] =>
    pages
      .filter((page) => page.parent === parent)
      .map((page) => ({ page, children: buildTree(page.id) }));

  return {
    pages,
    ids: pages.map((page) => page.id),
    byId: (id) => byId.get(id),
    byPath: (path) => byPath.get(path),
    tree: () => buildTree(null),
  };
}
