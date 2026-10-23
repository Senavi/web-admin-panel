# CLAUDE.md: rules for AI agents in this repository

Next.js 16 differs from older versions: read `AGENTS.md` (managed by `next dev`) and the
bundled docs in `node_modules/next/dist/docs/` before writing Next.js code.

This repo is a **reusable site starter**: a template-owned **core** (admin, auth, DB,
content system, SEO, i18n, analytics, storage, security) plus a replaceable **project
layer** (public site, content schemas, theme, `project.config.ts`). Full spec:
`docs/SPEC.md`. Architecture: `docs/ARCHITECTURE.md`. Decisions: `docs/DECISIONS.md`.

## Boundary: what you may edit

- **Project layer (edit freely):** `project.config.ts`, `src/content/**` (pages,
  collections, globals, forms), `src/site/**`, `src/app/(site)/**`, `public/**`.
- **Core (do not edit for project work):** `src/core/**`, `src/admin/**`,
  `src/app/(admin)/**`, `src/app/(access)/**`, `src/app/api/**`, metadata routes in
  `src/app/*.ts`, `scripts/**`.
  If a project needs different core behavior, use an extension point
  (`docs/CUSTOMIZING.md`) or change the template upstream.
- `src/core` and `src/admin` must never import `src/site`; the site never imports
  `src/admin`, `@/core/db` or auth server internals (ESLint enforces this).

## Add a page

1. Schema: `src/content/pages/<page>.ts` with `definePage` + `f.*` fields + seed content
   per locale (docs/CONTENT_SCHEMA.md). Register it in `src/content/index.ts` (`pages`).
2. View: `src/site/pages/<page>.tsx` built from sections in `src/site/sections/`.
3. Route: `src/app/(site)/[locale]/(pages)/<path>/page.tsx` →
   `const route = createPageRoute('<id>', View); export default route.Page; export const generateMetadata = route.generateMetadata;`
4. `pnpm content:sync` (or restart `pnpm dev`), then `pnpm content:check`.

## Add a collection (blog, projects…)

1. `src/content/collections/<id>.ts` with `defineCollection` (`listPageId`, `itemPath`,
   `fields`, `titleField`, seed items); a list page via "Add a page"; register both in
   `src/content/index.ts` (`collections: [...]`).
2. List route: `createCollectionListRoute('<pageId>', '<id>', View)` (+ `instant = false`).
3. Item route `…/<list path>/[slug]/page.tsx`: `createCollectionItemRoute('<id>', View)`,
   export `Page`, `generateMetadata`, `generateStaticParams` (+ `instant = false`).
4. `pnpm content:sync`, `pnpm content:check`. Data: `getCollectionList` / `getCollectionItem`.

## Repeated sections: shared sections, not globals

A section of page content that appears on several pages (CTA, testimonials, "why us") is a
**shared section**: `src/content/shared/<id>.ts` with `defineSharedSection`, placed in each
page's `sections` with `useShared(x)` in site order, registered in `sharedSections`. Globals
are only for layout chrome (header, footer, contacts, socials, announcement bar).
Lists: prefer plain values (`f.list({ of: f.text() })` → `string[]`) for tags and bullet
points; the editor layout (tags/lines/rows/cards) follows the item shape
(docs/CONTENT_SCHEMA.md § Lists).

## Add a global / a form

- Global: `src/content/globals/<id>.ts` with `defineGlobal`, register in `globals`, read with
  `getGlobalContent('<id>', locale)` (no route).
- Form: `src/content/forms/<id>.ts` with `defineForm`, register in `forms`, render with a
  client component on `useSiteForm` + `<FormSecurityFields>` (see
  `src/site/components/contact-form.tsx`); delivery in Settings → Requests.

Details: docs/CONTENT_SCHEMA.md. Add a field type: docs/CONTENT_SCHEMA.md § Adding a field
type.

## Design tokens: the rule

All visual values (colors, fonts, text styles, spacing, radii, shadows, motion) live
**only** in `src/site/theme/` (tokens.css, fonts.ts). Components use semantic classes
(`bg-primary`, `text-muted-foreground`) and text-style utilities (`text-h1`,
`<Heading>`, `<Text>`). No hex/rgb, no `text-[17px]`-style arbitrary values, no inline
visual styles. `pnpm tokens:check` fails otherwise. After editing tokens.css run
`pnpm tokens:generate`. See docs/DESIGN_TOKENS.md.

## Commands (pnpm via Corepack)

| Command                                                                  | Purpose                                                                                               |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                                               | Zero-config dev server (local PGlite DB, seeded demo, dev admin in `.data/dev-admin-credentials.txt`) |
| `pnpm build` / `pnpm start`                                              | Production build (no env → preview mode; with Supabase: 2 variables, docs/DEPLOYMENT.md)              |
| `pnpm typecheck` · `lint` · `format` · `test` · `e2e`                    | Quality gates                                                                                         |
| `pnpm content:sync` · `content:check`                                    | Seed missing content, update never-edited texts from changed seeds / verify routes ↔ registry         |
| `pnpm tokens:generate` · `tokens:check`                                  | Regenerate token TS / enforce the token rule                                                          |
| `pnpm db:generate` · `db:migrate` · `db:seed` · `db:studio` · `db:serve` | Database                                                                                              |
| `pnpm db:reset [--yes]`                                                  | Local only: delete `.data` database/uploads/mail, migrate, seed, print the new dev admin              |
| `pnpm admin:create`                                                      | Create an admin/manager (no public sign-up)                                                           |
| `pnpm e2e:prod` · `e2e:preview` · `check:bundles`                        | E2E against a production build / without any env (preview mode) / no admin code in site bundles       |

## Definition of done

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm content:check && pnpm tokens:check` pass;
   for routing/caching/security changes also `pnpm e2e:prod`.
2. UI changes are verified in a browser; e2e covers new user-facing behavior.
3. No `any`, no magic strings (use constants), no copy-pasted logic.
4. Docs updated when behavior or conventions change; decisions go in `docs/DECISIONS.md`.

Team workflow (docs/TEAM.md): final texts live in seeds (local admin edits stay local);
`content:sync` updates never-edited fields when a seed changes, so fix default texts in the
seed, not in a database.

Non-content public routes must be listed in `projectConfig.siteRoutes` (otherwise 404).

Admin URLs: always `adminHref(AdminRoute.X)`, never a literal `/admin` (the public path is
`projectConfig.adminPath`; e2e uses `admin()` from `tests/e2e/support/admin.ts`). Every admin
route segment has a `loading.tsx` built from `admin/components/layout/skeletons.tsx`.

Preview mode (production without `DATABASE_URL`) must keep working: site reads go through
the core loaders (they fall back to seeds), never `getDb()` directly from site code.

## Security rules: never relax

- Every mutation (server action / route handler) checks auth + permission **on the
  server**, validates input with Zod and writes an audit log entry. Hiding UI is not
  access control.
- Secrets stay server-side: no `NEXT_PUBLIC_` secrets, `import 'server-only'` in
  server modules. Database and auth secrets stay in env and are never stored in the
  database. The only exception is the credentials of integrations (email API key, SMTP
  password) entered in Settings → Integrations: stored AES-256-GCM encrypted
  (`src/core/integrations/crypto.ts`), never returned to the browser, never logged
  (docs/DECISIONS.md D-092).
- Don't weaken security headers, CSP, cookie flags, rate limits, upload validation or
  rich-text validation.
