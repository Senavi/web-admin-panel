/**
 * Verifies that public site pages never ship admin code (run after `pnpm build`).
 * Reads the prerendered site HTML, collects every referenced JS chunk and fails
 * if any contains admin-only libraries or modules.
 *
 *   pnpm check:bundles
 */
import fs from 'node:fs';
import path from 'node:path';

const NEXT_DIR = path.join(process.cwd(), '.next');
const APP_DIR = path.join(NEXT_DIR, 'server', 'app');
const MARKERS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Tiptap (rich text editor)', pattern: /tiptap|ProseMirror/ },
  { name: 'Recharts (charts)', pattern: /recharts/i },
  { name: 'react-hook-form', pattern: /react-hook-form|useFormContext/ },
  { name: 'Base UI / shadcn admin components', pattern: /@base-ui|data-sidebar|sidebar_state/ },
  { name: 'Better Auth', pattern: /better-auth/ },
  { name: 'Drizzle / database drivers', pattern: /drizzle-orm|pglite|postgres-js/ },
  { name: 'Admin modules', pattern: /src\/admin\/|admin-providers|page-editor/ },
];

function siteHtmlFiles(): string[] {
  if (!fs.existsSync(APP_DIR)) throw new Error('No build output found. Run `pnpm build` first.');
  return fs
    .readdirSync(APP_DIR, { recursive: true, encoding: 'utf8' })
    .filter(
      (file) =>
        file.endsWith('.html') &&
        !file.startsWith('admin') &&
        !file.includes('(admin)') &&
        !file.startsWith('_'),
    )
    .map((file) => path.join(APP_DIR, file));
}

const chunks = new Set<string>();
const pages = siteHtmlFiles();
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/\/_next\/(static\/[^"'\s]+\.js)/g))
    if (match[1]) chunks.add(match[1]);
}

const problems: string[] = [];
let bytes = 0;
for (const chunk of chunks) {
  const file = path.join(NEXT_DIR, chunk);
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  bytes += Buffer.byteLength(source);
  for (const marker of MARKERS)
    if (marker.pattern.test(source)) problems.push(`${chunk}: contains ${marker.name}`);
}

if (pages.length === 0 || chunks.size === 0) {
  console.error('check:bundles found no prerendered site pages or chunks. Is the build complete?');
  process.exit(1);
}
if (problems.length > 0) {
  console.error(`Admin code found in public site bundles:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.info(
  `check:bundles passed: ${pages.length} site pages, ${chunks.size} chunks (${(bytes / 1024).toFixed(0)} KB uncompressed), no admin code.`,
);
