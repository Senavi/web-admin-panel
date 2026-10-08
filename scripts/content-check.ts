/**
 * Fails when registered pages and site routes are out of sync.
 *
 *   pnpm content:check
 */
import fs from 'node:fs';
import path from 'node:path';

import { registry } from '@/content';
import { checkRoutes, type RouteFile } from '@/core/content/route-check';

const SITE_APP_DIR = path.join(process.cwd(), 'src', 'app', '(site)');

function findPageFiles(dir: string): RouteFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /(^|[\\/])page\.(tsx|ts|jsx|js)$/.test(file))
    .map((file) => ({ file, source: fs.readFileSync(path.join(dir, file), 'utf8') }));
}

const problems = checkRoutes(
  registry.pages.map((page) => ({ id: page.id, path: page.path })),
  findPageFiles(SITE_APP_DIR),
);

if (problems.length > 0) {
  console.error(`content:check found ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.info(`content:check passed: ${registry.pages.length} pages, all routed.`);
