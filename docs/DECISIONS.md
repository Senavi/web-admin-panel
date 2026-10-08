# Decisions

Architecture decision log. Each entry records **what** was decided, **why**, and
what would make us revisit it. Newest entries at the bottom of each section.

## Tooling

### D-001 TypeScript 6.0, not 7.0

TypeScript 7.0.2 (the Go-based compiler) is the latest release, but `typescript-eslint`
supports `typescript >=4.8.4 <6.1.0`. Type-aware lint rules are part of the quality bar,
so we pin TypeScript 6.0.x. **Revisit** when typescript-eslint supports TS 7.

### D-002 pnpm 11 via Corepack

`packageManager: pnpm@11.28.2`. pnpm 12 ships as a native binary that older Corepack
releases cannot launch. pnpm 11 is fully supported. Build scripts are allow-listed in
`pnpm-workspace.yaml` (`allowBuilds`), which is pnpm 11's supply-chain default.

### D-003 Node 24 LTS

`.nvmrc` pins Node 24 (current LTS, used in CI and deploys). `engines` accepts
`>=22.13` so contributors on the previous LTS are not blocked.

### D-004 Tailwind via the Turbopack loader

Next.js 16.4's `create-next-app` default wires Tailwind 4 through
`@tailwindcss/turbopack` in `next.config.ts` instead of PostCSS. We follow the
framework default.

### D-005 Cache Components

`cacheComponents: true` + `partialPrefetching: true` (Next.js 16.4 defaults). Data is
cached with `'use cache'` + `cacheLife` + `cacheTag` and invalidated with
`updateTag` (server actions) / `revalidateTag(tag, 'max')` (route handlers).

### D-006 Import boundaries via `no-restricted-imports`

Boundaries (core/admin ↛ site, site ↛ admin, site ↛ DB/auth internals) are enforced
with per-folder `no-restricted-imports` overrides in `eslint.config.mjs` instead of
adding `eslint-plugin-boundaries`. That's one less dependency, and the rules are readable in one place.

### D-007 Multiple root layouts

The public site (`src/app/(site)`) and admin (`src/app/(admin)`) each own their root
layout and stylesheet. Site pages never load admin CSS or JS, and the admin keeps
shadcn's theme independent of the site's design tokens.

### D-008 Single `AUTH_SECRET`

One secret signs Better Auth sessions and the site-gate cookie (sub-keys are derived
with HMAC and a purpose label). This means fewer variables to configure and rotate. In development
a random secret is generated into `.data/` so zero-config works.
