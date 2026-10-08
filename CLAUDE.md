# CLAUDE.md: rules for AI agents in this repository

@AGENTS.md

This repo is a **reusable site starter**: a template-owned **core** (admin, auth, DB,
content system, SEO, i18n, analytics, storage, security) plus a replaceable **project
layer** (public site, content schemas, theme, `project.config.ts`). Full spec:
`docs/SPEC.md`. Architecture: `docs/ARCHITECTURE.md`. Decisions: `docs/DECISIONS.md`.

## Boundary: what you may edit

- **Project layer (edit freely):** `project.config.ts`, `src/content/**`, `src/site/**`,
  `src/app/(site)/**`, `public/**`.
- **Core (do not edit for project work):** `src/core/**`, `src/admin/**`,
  `src/app/(admin)/**`, `src/app/api/**`, `src/app/access/**`, `scripts/**`.
  If a project needs different core behavior, use an extension point
  (`docs/CUSTOMIZING.md`) or change the template upstream.
- `src/core` and `src/admin` must never import `src/site`; the site never imports
  `src/admin`, `@/core/db` or auth server internals (ESLint enforces this).

## Add a page

1. Schema: `src/content/pages/<page>.ts` with `definePage` + `f.*` fields + seed content
   per locale (docs/CONTENT_SCHEMA.md). Register it in `src/content/index.ts`.
2. View: `src/site/pages/<page>.tsx` built from sections in `src/site/sections/`.
3. Route: `src/app/(site)/[locale]/<path>/page.tsx` →
   `const route = createPageRoute('<id>', View); export default route.Page; export const generateMetadata = route.generateMetadata;`
4. `pnpm content:sync` (or restart `pnpm dev`), then `pnpm content:check`.

Add a field type: docs/CONTENT_SCHEMA.md § Adding a field type.

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
| `pnpm build` / `pnpm start`                                              | Production build (needs `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`)                        |
| `pnpm typecheck` · `lint` · `format` · `test` · `e2e`                    | Quality gates                                                                                         |
| `pnpm content:sync` · `content:check`                                    | Seed missing content / verify routes ↔ registry                                                       |
| `pnpm tokens:generate` · `tokens:check`                                  | Regenerate token TS / enforce the token rule                                                          |
| `pnpm db:generate` · `db:migrate` · `db:seed` · `db:studio` · `db:serve` | Database                                                                                              |
| `pnpm admin:create`                                                      | Create an admin/manager (no public sign-up)                                                           |

## Definition of done

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm content:check && pnpm tokens:check` pass.
2. UI changes are verified in a browser; e2e covers new user-facing behavior.
3. No `any`, no magic strings (use constants), no copy-pasted logic.
4. Docs updated when behavior or conventions change; decisions go in `docs/DECISIONS.md`.

## Security rules: never relax

- Every mutation (server action / route handler) checks auth + permission **on the
  server**, validates input with Zod and writes an audit log entry. Hiding UI is not
  access control.
- Secrets stay server-side: no `NEXT_PUBLIC_` secrets, `import 'server-only'` in
  server modules, never store secrets in the database.
- Don't weaken security headers, CSP, cookie flags, rate limits, upload validation or
  rich-text validation.
