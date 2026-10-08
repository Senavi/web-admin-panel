# Architecture

> Status: written incrementally per implementation phase. See `docs/SPEC.md` for the full spec.

## Layers

| Layer          | Path                                                   | Owner    | Replaced per project? |
| -------------- | ------------------------------------------------------ | -------- | --------------------- |
| Core logic     | `src/core/**`                                          | template | no                    |
| Admin UI       | `src/admin/**`, `src/app/(admin)/**`                   | template | no                    |
| Core routes    | `src/app/api/**`, `src/app/access/**`, metadata routes | template | no                    |
| Project config | `project.config.ts`                                    | project  | yes                   |
| Content schema | `src/content/**`                                       | project  | yes                   |
| Public site    | `src/site/**`, `src/app/(site)/**`                     | project  | yes                   |

## Boundaries

Enforced by ESLint (`eslint.config.mjs`):

- `src/core` and `src/admin` never import `src/site`.
- `src/site`, `src/content` and `src/app/(site)` never import `src/admin` or core server
  internals (`@/core/db`, `@/core/auth/server`). They read data through core loaders.
- Core learns about the project only via `project.config.ts` (`@project/config`) and the
  page registry exported from `src/content`.
- Server-only modules start with `import 'server-only'`.

## Environment

`src/core/env-schema.ts` defines the Zod schema. `src/core/env.ts` exposes `env()` and
`src/instrumentation.ts` validates it at server startup.
