# CLAUDE.md: rules for AI agents in this repository

@AGENTS.md

This repo is a **reusable site starter**: a template-owned **core** (admin, auth, DB,
content system, SEO, i18n, analytics, storage, security) plus a replaceable **project
layer** (public site, content schemas, theme, `project.config.ts`). Full spec:
`docs/SPEC.md`. Architecture: `docs/ARCHITECTURE.md`.

## Boundary: what you may edit

- **Project layer (edit freely):** `project.config.ts`, `src/content/**`, `src/site/**`,
  `src/app/(site)/**`, `public/**`.
- **Core (do not edit for project work):** `src/core/**`, `src/admin/**`,
  `src/app/(admin)/**`, `src/app/api/**`, `src/app/access/**`, `scripts/**`.
  If a project needs different core behavior, use an extension point
  (`docs/CUSTOMIZING.md`) or change the template upstream.
- `src/core` and `src/admin` must never import `src/site` (ESLint enforces this).

## Commands (pnpm via Corepack)

`pnpm dev` · `build` · `start` · `typecheck` · `lint` · `format` · `test` · `e2e`

## Definition of done

1. `pnpm typecheck && pnpm lint && pnpm test` pass.
2. UI changes are verified in a browser; e2e covers new user-facing behavior.
3. No `any`, no magic strings (use constants), no copy-pasted logic.
4. Docs updated when behavior or conventions change; decisions go in `docs/DECISIONS.md`.

## Security rules: never relax

- Every mutation (server action / route handler) checks auth + permission **on the
  server**, validates input with Zod and writes an audit log entry. Hiding UI is not
  access control.
- Secrets stay server-side: no `NEXT_PUBLIC_` secrets, `import 'server-only'` in
  server modules, never store secrets in the database.
- Don't weaken security headers, CSP, cookie flags, rate limits or upload validation.
