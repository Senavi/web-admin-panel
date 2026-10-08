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

## Database

### D-009 One schema, explicit column names

Drizzle tables use explicit snake_case column names. Better Auth's tables keep its
field names as TypeScript properties, and the adapter maps models to our plural table
names (`users`, `sessions`, …). The same drizzle-kit migrations run on PGlite and Postgres.

### D-010 Settings as validated JSON

`settings` is a singleton row (`CHECK id = 1`) and `settings_localized` has one row per
locale. Both store JSONB validated by Zod schemas with defaults for every field. Adding
a setting needs no migration, and older rows are completed by `parse()`.

### D-011 PGlite process lock

PGlite is single-process. A pid lock file (`.data/pglite.lock`) turns concurrent access
(e.g. a CLI script while `pnpm dev` runs) into a clear error instead of corruption.

### D-012 Postgres-mode tests without Docker

Unit tests exercise the postgres-js driver against PGlite over the Postgres wire
protocol (`@electric-sql/pglite-socket`). CI additionally runs build + e2e against a
real `postgres:17` service container.

### D-013 Analytics visits = daily unique visitors

Without cookies, a "visit" is approximated as one daily-rotating visitor hash.
"Pages per visit" = page views / unique visitors for the period. Because hashes rotate
daily, summing daily unique visitors across days is correct by construction.

## Auth

### D-014 Auth mutations only via server actions

Better Auth's `disabledPaths` only affects its HTTP router, so direct HTTP calls could
bypass our throttling, audit log and site-gate cookie. `src/app/api/auth/[...all]` forwards
an **allowlist** (`/get-session`, `/sign-out`, `/ok`). Sign-in, 2FA, password and session
changes run in server actions that call `auth.api.*` directly.

### D-015 Users are created outside Better Auth's sign-up

Sign-up is disabled. `createUserWithPassword` writes the user + credential account with
Better Auth's own `hashPassword` (scrypt, memory-hard) so the CLI, dev seed and Managers
page share one code path without needing an HTTP context.

### D-016 Login throttling in our own table

Better Auth's DB rate limiter only runs for HTTP requests. `login_throttle` tracks failures
per email and per hashed IP, with exponential backoff (5 free attempts per email,
then 30 s doubling to 15 min; 20 per IP). Messages stay generic.

### D-017 Password policy

12–128 chars, not in a bundled list of common 12+ char passwords (NCSC 100k list from
SecLists), at least 5 distinct characters, must not contain the email name.

### D-018 Zero-config dev admin without default credentials

In development, if no users exist and no `SEED_ADMIN_*` is set, an admin
`admin@localhost.test` is created with a **random** password written to
`.data/dev-admin-credentials.txt` (gitignored). Nothing secret ships in the repo.

### D-019 Forbidden admin pages return 404

Without permission an admin page calls `notFound()`, because `forbidden()` still needs the
experimental `authInterrupts` flag in Next.js 16.4. Server actions return an
`unauthorized` `ActionResult`.

### D-020 Admin opts out of instant-navigation validation

The admin is auth-gated and rendered per request. Its layouts set `export const instant = false`
and the proxy redirects requests without a session cookie to the login page (optimistic
check; pages still verify the session).
