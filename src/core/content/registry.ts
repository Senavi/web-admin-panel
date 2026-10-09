import type { AnyPage } from './define';

/**
 * Content registry: the project's fixed set of pages (`src/content/index.ts`).
 * Validates ids, paths and parents once at startup and provides lookups and
 * the page tree used by the admin.
 *
 *   createRegistry([homePage, aboutPage])            // pages only (v1.1 form)
 *   createRegistry({ pages: [homePage, aboutPage] }) // object form
 */

export interface PageTreeNode {
  readonly page: AnyPage;
  readonly children: readonly PageTreeNode[];
}

export interface RegistryInput<P extends readonly AnyPage[]> {
  readonly pages: P;
}

export interface PageRegistry<P extends readonly AnyPage[] = readonly AnyPage[]> {
  readonly pages: P;
  readonly ids: readonly P[number]['id'][];
  byId(id: string): P[number] | undefined;
  byPath(path: string): P[number] | undefined;
  tree(): PageTreeNode[];
}

/** Stable ids are kebab-case: they are DB keys and admin URL segments. */
export const CONTENT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Admin URL segments under /admin/pages that page ids must not use. */
export const RESERVED_PAGE_IDS: ReadonlySet<string> = new Set([
  'collections',
  'site-wide',
  'forms',
]);

export function assertContentId(kind: string, id: string): void {
  if (!CONTENT_ID.test(id)) {
    throw new Error(`${kind} id "${id}" must be kebab-case (lowercase letters, digits, dashes).`);
  }
}

export function createRegistry<const P extends readonly AnyPage[]>(
  input: P | RegistryInput<P>,
): PageRegistry<P> {
  const pages: P = isPageList(input) ? input : input.pages;
  const byId = new Map<string, P[number]>();
  const byPath = new Map<string, P[number]>();
  for (const page of pages) {
    assertContentId('Page', page.id);
    if (RESERVED_PAGE_IDS.has(page.id)) throw new Error(`Page id "${page.id}" is reserved.`);
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

function isPageList<P extends readonly AnyPage[]>(input: P | RegistryInput<P>): input is P {
  return Array.isArray(input);
}
