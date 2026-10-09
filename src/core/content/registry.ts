import { matchesRoute } from '@/core/i18n/route-match';
import { PagesArea } from '@/core/project/paths';

import { type AnyCollection, collectionBasePath } from './collection';
import type { AnyGlobal } from './global';
import type { AnyPage } from './define';

/**
 * Content registry: the project's fixed set of pages (`src/content/index.ts`).
 * Validates ids, paths and parents once at startup and provides lookups and
 * the page tree used by the admin.
 *
 *   createRegistry([homePage, aboutPage])                       // pages only (v1.1 form)
 *   createRegistry({ pages: [homePage, blogPage], collections: [blog] })
 */

export interface PageTreeNode {
  readonly page: AnyPage;
  readonly children: readonly PageTreeNode[];
}

export interface RegistryInput<
  P extends readonly AnyPage[],
  C extends readonly AnyCollection[] = readonly [],
  G extends readonly AnyGlobal[] = readonly [],
> {
  readonly pages: P;
  readonly collections?: C;
  readonly globals?: G;
}

export interface PageRegistry<
  P extends readonly AnyPage[] = readonly AnyPage[],
  C extends readonly AnyCollection[] = readonly AnyCollection[],
  G extends readonly AnyGlobal[] = readonly AnyGlobal[],
> {
  readonly pages: P;
  readonly ids: readonly P[number]['id'][];
  byId(id: string): P[number] | undefined;
  byPath(path: string): P[number] | undefined;
  tree(): PageTreeNode[];
  readonly collections: C;
  collectionById(id: string): C[number] | undefined;
  readonly globals: G;
  globalById(id: string): G[number] | undefined;
}

/** Stable ids are kebab-case: they are DB keys and admin URL segments. */
export const CONTENT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Admin URL segments under /admin/pages that page ids must not use. */
export const RESERVED_PAGE_IDS: ReadonlySet<string> = new Set(Object.values(PagesArea));

export function assertContentId(kind: string, id: string): void {
  if (!CONTENT_ID.test(id)) {
    throw new Error(`${kind} id "${id}" must be kebab-case (lowercase letters, digits, dashes).`);
  }
}

export function createRegistry<const P extends readonly AnyPage[]>(
  pages: P,
): PageRegistry<P, readonly [], readonly []>;
export function createRegistry<
  const P extends readonly AnyPage[],
  const C extends readonly AnyCollection[] = readonly [],
  const G extends readonly AnyGlobal[] = readonly [],
>(input: RegistryInput<P, C, G>): PageRegistry<P, C, G>;
export function createRegistry(input: readonly AnyPage[] | AnyRegistryInput): PageRegistry {
  const pages = isPageList(input) ? input : input.pages;
  const collections = isPageList(input) ? [] : (input.collections ?? []);
  const globals = isPageList(input) ? [] : (input.globals ?? []);
  const byId = new Map<string, AnyPage>();
  const byPath = new Map<string, AnyPage>();
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

  const collectionById = new Map<string, AnyCollection>();
  for (const collection of collections) {
    assertContentId('Collection', collection.id);
    if (collectionById.has(collection.id))
      throw new Error(`Duplicate collection id "${collection.id}".`);
    collectionById.set(collection.id, collection);
    const listPage = byId.get(collection.listPageId);
    if (!listPage) {
      throw new Error(
        `Collection "${collection.id}": listPageId "${collection.listPageId}" is not a registered page.`,
      );
    }
    if (collectionBasePath(collection) !== listPage.path) {
      throw new Error(
        `Collection "${collection.id}": itemPath "${collection.itemPath}" must start with the list page path "${listPage.path}".`,
      );
    }
    for (const page of pages) {
      if (matchesRoute(page.path, collection.itemPath)) {
        throw new Error(
          `Page "${page.id}" (${page.path}) conflicts with collection "${collection.id}" item URLs (${collection.itemPath}).`,
        );
      }
    }
    for (const other of collectionById.values()) {
      if (other !== collection && other.itemPath === collection.itemPath) {
        throw new Error(`Collections "${other.id}" and "${collection.id}" share an itemPath.`);
      }
    }
  }

  const globalById = new Map<string, AnyGlobal>();
  for (const global of globals) {
    assertContentId('Global', global.id);
    if (globalById.has(global.id)) throw new Error(`Duplicate global id "${global.id}".`);
    globalById.set(global.id, global);
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
    collections,
    collectionById: (id) => collectionById.get(id),
    globals,
    globalById: (id) => globalById.get(id),
  };
}

type AnyRegistryInput = RegistryInput<
  readonly AnyPage[],
  readonly AnyCollection[],
  readonly AnyGlobal[]
>;

function isPageList(input: readonly AnyPage[] | AnyRegistryInput): input is readonly AnyPage[] {
  return Array.isArray(input);
}
