/**
 * `pnpm demo:remove`: the first step of a new project (docs/CUSTOMIZING.md § Remove the
 * demo site). Deletes the demo pages, sections, routes, blog, contact form, shared
 * section, seed images, texts and demo specs in one go; keeps the infrastructure
 * (layout, UI components, theme, storybook, the `site` global for header/footer)
 * and leaves a minimal home page, so the site, the admin and the core specs keep
 * working. Then runs `pnpm typecheck` and `pnpm content:check`.
 *
 * Runs once: `src/content/DEMO.md` marks the demo and is deleted with it. Everything
 * it changes is tracked by git (`git diff` / `git checkout .` to review or undo).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { projectConfig } from '../project.config';

const ROOT = process.cwd();
const DEMO_MARKER = 'src/content/DEMO.md';
const ROUTES = 'src/app/(site)/[locale]/(pages)';
const MESSAGES_DIR = 'src/site/messages';
const SEED_ASSETS = 'src/content/seed/assets';

/** Files and folders of the demo (relative to the repo root). */
const DEMO_PATHS = [
  'src/content/pages/about.ts',
  'src/content/pages/team.ts',
  'src/content/pages/blog.ts',
  'src/content/pages/contact.ts',
  'src/content/collections',
  'src/content/forms',
  'src/content/shared',
  'src/site/pages/about.tsx',
  'src/site/pages/team.tsx',
  'src/site/pages/blog.tsx',
  'src/site/pages/blog-post.tsx',
  'src/site/pages/contact.tsx',
  'src/site/sections',
  'src/site/components/contact-form.tsx',
  'src/site/components/feature-icon.tsx',
  `${ROUTES}/about`,
  `${ROUTES}/blog`,
  `${ROUTES}/contact`,
  'tests/e2e/demo',
  'tests/unit/demo',
  DEMO_MARKER,
] as const;

/** Interface-text namespaces only the demo pages, blog and contact form use. */
const DEMO_NAMESPACES = ['contact', 'blog', 'forms'] as const;
/** Kept but emptied: the header and footer read it for the project's menu labels. */
const NAV_NAMESPACE = 'nav';

const STARTER: Record<string, string> = {
  'src/content/index.ts': `/**
 * PROJECT: content registry. Every page of the public site, every collection,
 * global and form is listed here; the admin, sitemap and content checks are built
 * from it. See docs/CONTENT_SCHEMA.md.
 */
import { createRegistry } from '@/core/content/registry';

import { siteGlobals } from './globals/site';
import { homePage } from './pages/home';

export const registry = createRegistry({
  pages: [homePage],
  collections: [],
  globals: [siteGlobals],
  forms: [],
  sharedSections: [],
});
`,
  'src/content/pages/home.ts': `/**
 * PROJECT: the home page (docs/CONTENT_SCHEMA.md). Replace the fields with the
 * design's sections; put the final copy into \`seed\`.
 */
import { definePage, defineSection } from '@/core/content/define';
import { f } from '@/core/content/fields';

export const homePage = definePage({
  id: 'home',
  path: '/',
  label: 'Home',
  parent: null,
  seo: {
    title: 'Home',
    description: '',
  },
  sections: [
    defineSection({
      id: 'hero',
      label: 'Hero',
      fields: {
        title: f.text({ label: 'Title', required: true, max: 120 }),
        lead: f.textarea({ label: 'Lead', max: 400 }),
      },
    }),
  ],
  seed: {
    ${JSON.stringify(projectConfig.defaultLocale)}: {
      hero: {
        title: ${JSON.stringify(projectConfig.name)},
        lead: 'This page is a placeholder: build the home page from the design.',
      },
    },
  },
});
`,
  'src/site/pages/home.tsx': `/** PROJECT: the home page view, built from sections in src/site/sections/. */
import type { PageViewProps } from '@/core/content/page-route';

import { Container, Section } from '../components/ui/layout';
import { Heading, Text } from '../components/ui/typography';

export function HomeView({ content }: PageViewProps<'home'>) {
  return (
    <Section labelledBy="home-title">
      <Container width="prose" className="flex flex-col gap-6">
        <Heading level={1} id="home-title">
          {content.hero.title}
        </Heading>
        {content.hero.lead ? (
          <Text variant="lead" tone="muted">
            {content.hero.lead}
          </Text>
        ) : null}
      </Container>
    </Section>
  );
}
`,
  'src/site/navigation.ts': `/**
 * PROJECT: header and footer navigation. Labels come from the \`nav\` interface
 * texts (src/site/messages/*.json + src/content/ui-texts.ts).
 */
import { registry } from '@/content';

export interface NavItem {
  readonly pageId: string;
  readonly messageKey: string;
}

/** e.g. { pageId: 'about', messageKey: 'about' } with "nav": { "about": "About" } in the messages. */
export const HEADER_NAV: readonly NavItem[] = [];

export function pagePath(pageId: string): string {
  const page = registry.byId(pageId);
  if (!page) throw new Error(\`Navigation refers to unknown page "\${pageId}".\`);
  return page.path;
}
`,
};

function remove(relative: string): boolean {
  const target = path.join(ROOT, relative);
  if (!fs.existsSync(target)) return false;
  fs.rmSync(target, { recursive: true, force: true });
  return true;
}

/** Drops the demo namespaces from every messages file; empties `nav`. */
function trimMessages(): string[] {
  const dir = path.join(ROOT, MESSAGES_DIR);
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.json'));
  for (const file of files) {
    const full = path.join(dir, file);
    const messages = JSON.parse(fs.readFileSync(full, 'utf8')) as Record<string, unknown>;
    for (const namespace of DEMO_NAMESPACES) delete messages[namespace];
    if (NAV_NAMESPACE in messages) messages[NAV_NAMESPACE] = {};
    fs.writeFileSync(full, `${JSON.stringify(messages, null, 2)}\n`);
  }
  return files;
}

/** The interface-text catalog without the demo namespaces (nav kept, empty). */
function trimUiTexts(): void {
  const file = path.join(ROOT, 'src/content/ui-texts.ts');
  let source = fs.readFileSync(file, 'utf8');
  for (const namespace of DEMO_NAMESPACES) {
    // `    blog: { … },` up to the closing `    },` at the same indentation.
    source = source.replace(new RegExp(String.raw`\n    ${namespace}: \{\n[\s\S]*?\n    \},`), '');
  }
  source = source.replace(
    new RegExp(
      String.raw`(\n    ${NAV_NAMESPACE}: \{\n      label: '[^']*',\n      texts: )\{[\s\S]*?\n      \}`,
    ),
    '$1{}',
  );
  fs.writeFileSync(file, source);
}

function run(args: readonly string[]): boolean {
  console.info(`\n[demo:remove] pnpm ${args.join(' ')}`);
  return (
    spawnSync('pnpm', args, { stdio: 'inherit', shell: process.platform === 'win32' }).status === 0
  );
}

function main(): number {
  if (!fs.existsSync(path.join(ROOT, DEMO_MARKER))) {
    console.info(`[demo:remove] ${DEMO_MARKER} is missing: the demo was already removed.`);
    return 0;
  }
  const removed = DEMO_PATHS.filter(remove);
  for (const file of fs.readdirSync(path.join(ROOT, SEED_ASSETS))) {
    if (file !== '.gitkeep') fs.rmSync(path.join(ROOT, SEED_ASSETS, file));
  }
  fs.writeFileSync(path.join(ROOT, SEED_ASSETS, '.gitkeep'), '');
  for (const [file, source] of Object.entries(STARTER)) {
    fs.writeFileSync(path.join(ROOT, file), source);
  }
  const messages = trimMessages();
  trimUiTexts();

  console.info(`[demo:remove] removed ${removed.length} demo paths and the seed images:`);
  for (const item of removed) console.info(`  - ${item}`);
  console.info(
    `[demo:remove] wrote a minimal home page, an empty menu and the registry; trimmed ${messages.join(', ')} and src/content/ui-texts.ts.`,
  );
  const ok =
    run(['exec', 'prettier', '--write', '.', '--log-level=warn']) &&
    run(['typecheck']) &&
    run(['content:check']);
  console.info(
    ok
      ? '\n[demo:remove] Done. Next: tokens (src/site/theme), the pages of the design, and e2e specs for them (docs/CUSTOMIZING.md).'
      : '\n[demo:remove] Removed, but a check failed: see above.',
  );
  return ok ? 0 : 1;
}

process.exit(main());
