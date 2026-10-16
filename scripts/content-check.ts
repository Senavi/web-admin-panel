/**
 * Fails when registered pages/collections and site routes are out of sync;
 * warns about shared sections no page uses; checks the /storybook project slot.
 *
 *   pnpm content:check
 */
import fs from 'node:fs';
import path from 'node:path';

import { contentRegistry as registry } from '@/core/content/project-registry';
import { checkRoutes, type RouteFile } from '@/core/content/route-check';
import { checkStorybookSlot, STORYBOOK_SLOT_FILE } from '@/core/storybook/slot';
import { uiTextCatalog } from '@/core/ui-texts/project-catalog';
import { checkUiTexts, type SourceFile } from '@/core/ui-texts/usage-check';

const SITE_APP_DIR = path.join(process.cwd(), 'src', 'app', '(site)');

function findPageFiles(dir: string): RouteFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /(^|[\\/])page\.(tsx|ts|jsx|js)$/.test(file))
    .map((file) => ({ file, source: fs.readFileSync(path.join(dir, file), 'utf8') }));
}

const slotPath = path.join(process.cwd(), STORYBOOK_SLOT_FILE);
const problems = checkRoutes(
  registry.pages.map((page) => ({ id: page.id, path: page.path })),
  findPageFiles(SITE_APP_DIR),
  registry.collections.map((collection) => ({ id: collection.id, itemPath: collection.itemPath })),
);

problems.push(
  ...checkStorybookSlot(fs.existsSync(slotPath) ? fs.readFileSync(slotPath, 'utf8') : null),
);

// Interface texts: keys used in site code exist; every namespace used is declared somewhere.
function readSources(dir: string): SourceFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.(tsx?|jsx?)$/.test(file))
    .map((file) => ({
      file: path.join(path.relative(process.cwd(), dir), file),
      source: fs.readFileSync(path.join(dir, file), 'utf8'),
    }));
}
const declaredUiTexts = new Set(
  [
    ...registry.pages.map((page) => page.uiTexts),
    ...registry.globals.map((global) => global.uiTexts),
    ...registry.collections.map((collection) => collection.uiTexts),
    ...registry.forms.map((form) => form.uiTexts),
  ].flatMap((namespaces) => namespaces ?? []),
);
problems.push(
  ...checkUiTexts({
    catalog: uiTextCatalog,
    files: [...readSources(path.join(process.cwd(), 'src', 'site')), ...readSources(SITE_APP_DIR)],
    declared: declaredUiTexts,
  }),
);

// Shared sections: unknown ids already fail when the registry is built.
const unused = registry.sharedSections.filter(
  (shared) => registry.pagesUsingShared(shared.id).length === 0,
);
for (const shared of unused) {
  console.warn(
    `content:check warning: shared section "${shared.id}" is not used by any page (add useShared(${shared.id}) to a page's sections, or remove it).`,
  );
}

if (problems.length > 0) {
  console.error(`content:check found ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.info(
  `content:check passed: ${registry.pages.length} pages, ${registry.collections.length} collection(s), ${registry.sharedSections.length} shared section(s), all routed.`,
);
