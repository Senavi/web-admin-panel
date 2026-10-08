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

## Admin UI

### D-021 shadcn/ui "base-nova" (Base UI) defaults

`shadcn init -d` in shadcn 4.21 uses the `base-nova` style built on Base UI. We keep
it unmodified (spec: default styling). Components live in `src/admin/ui` (generated, but
lint-clean), composites in `src/admin/components`. Buttons that render links set
`nativeButton={false}`.

### D-022 Blocking admin pages

Admin pages and the panel layout set `export const instant = false` and run their guards
at the top level (no Suspense around auth). Next.js then renders before streaming, so a
manager opening `/admin/settings` gets a real **HTTP 404** instead of a 200 with
not-found UI. Admin isn't a candidate for static shells anyway.

### D-023 No import-order lint rule

`eslint-plugin-import`'s `import/order` crashes on ESLint 10 (`getTokenOrCommentBefore`).
Import grouping stays a convention (builtin → external → `@project` / `@/` → relative).
**Revisit** when the plugin supports ESLint 10.

## Content, site and tokens

### D-024 `pnpm dev` owns PGlite and serves it to Next.js workers

Next.js 16 runs `'use cache'` functions and `generateStaticParams` in separate worker
processes, but PGlite is single-process. `scripts/dev.ts` opens `.data/pglite`, migrates,
seeds and serves it on 127.0.0.1 over the Postgres protocol (pglite-socket). `next dev`
receives `PGLITE_SERVER_URL` and every worker uses postgres-js. pglite-socket's own queue
isolates only transactions, so our `SessionQueue` locks the database to one connection
until its extended-protocol pipeline ends (`Sync`/`Query`). Covered by a concurrency test.
CLI scripts reuse the running server via `.data/pglite-server.json`. `pnpm db:serve`
exposes the same database for local production builds.

### D-025 File-based site routes + `createPageRoute`

Each page has a normal Next.js route file that calls `createPageRoute('<id>', View)`.
It's idiomatic, easy for agents to follow, and `content:check` can verify it statically
(regex on the call + the folder path). A catch-all `[...rest]` route renders the localized 404.

### D-026 Own locale routing in the proxy; next-intl only for UI strings

The default locale and enabled locales are **settings** (changeable at runtime), but
next-intl's routing/middleware is configured statically. The proxy implements the small
rule set itself (`src/core/i18n/routing.ts`, unit-tested). next-intl provides messages via
`src/site/i18n/request.ts`, which reads the locale with `next/root-params`.

### D-027 Rich text as validated JSON

Tiptap/ProseMirror-compatible JSON with a strict Zod allowlist, rendered by our own
JSON→React renderer. No HTML sanitizer is needed because no HTML is stored or injected.

### D-028 Tokens: CSS is the source, TypeScript is generated

`tokens.css` (Tailwind v4 `@theme` + `:root`) holds every raw value. Tailwind's default
namespaces are reset so only project tokens exist. `tokens.generated.ts` is produced by
`pnpm tokens:generate` and checked for staleness by `pnpm tokens:check`, together with a
scanner for raw values in site code.

### D-029 Seed images and demo artwork

Seed content references images by file name (`{ asset: 'hero.webp' }`). `content:sync`
imports them once through the normal upload pipeline (`media.seed_asset` marks them). The
demo images are abstract gradients generated with sharp, so there are no licensing concerns.

### D-030 Storage adapters early

The storage adapter (local `.data/uploads` served by `/api/media/[...key]`, or Supabase
Storage) and the image ingest pipeline (magic bytes, sharp re-encode to WebP, metadata
stripped, limits, blur placeholder) arrived with the content system because seeds need them.

## Pages editor

### D-031 react-hook-form + Zod schemas generated from the page

The editor uses react-hook-form with `zodResolver` over the same `pageContentSchema` the
server action validates with. Server-side field errors come back as `content.<section>.<field>`
paths and are mapped onto the form.

### D-032 List reordering with buttons, no drag-and-drop library

Items move with "Move up / Move down" buttons (keyboard and screen-reader friendly, no
extra dependency). A drag handle can be added later without changing the data model.

### D-033 Tiptap limited to the allowed schema

Tiptap's StarterKit is configured without blockquote, code, strike, underline and rules,
with headings h2–h4, so editors cannot produce content the rich-text schema rejects
(nested lists are still caught by validation).

### D-034 Optimistic concurrency per row

Shared values, localized values and SEO each carry a `version`. A save writes only the rows
that changed and only if their version still matches what the editor loaded. Otherwise the
transaction rolls back and the editor shows a conflict with a reload option.

### D-035 Upload size limit of 4 MB

Serverless request bodies are limited (Vercel ≈ 4.5 MB), so image uploads go through
`/api/media` with a 4 MB cap. Larger uploads would need direct-to-storage signed URLs,
which is a possible future extension.

### D-036 Forms that never leak secrets in URLs

The login form is a server-action form (`useActionState`), so it works before hydration
and without JavaScript. Every other admin form sets `method="post"`, so a submit before
hydration can't put passwords in the query string.

## Settings & site gate

### D-037 Site state over an internal, keyed endpoint

The proxy must not use the database. It reads `/api/site-state` (a `'use cache'` loader with
tags `settings` + `staff`), authenticated with an HMAC of `AUTH_SECRET`, and caches it in
memory for ~3 s (`SITE_STATE_TTL_MS`). Changes apply within seconds on every instance,
with no shared cache service required (works the same on Vercel and Netlify).

### D-038 Staff list in the site state

To reject disabled users and sessions revoked by a password change without a DB lookup, the
state includes `{ userId: sessionVersion }` for active staff. It is small (admin users only)
and never public.

### D-039 Maintenance via rewrite with status 503

`NextResponse.rewrite(url, { status: 503 })` renders the project's maintenance page (a
normal static route) with a 503 status and `Retry-After`, so the page can use site tokens
and fonts. The route lives outside the `(pages)` group so it has no header/footer.

### D-040 SVG logos sanitized with svgo + strict checks

SVG is accepted only for logos. svgo removes scripts and event handlers, and a deny-list
then rejects foreignObject, external references, `javascript:`, entities and non-image
data URLs. Files are served with `Content-Security-Policy: sandbox` and used only as
`<img>` sources.

### D-041 Favicons generated at upload

One uploaded image produces 16/32/48/192/512 PNGs, a 180×180 Apple touch icon (flattened
on the theme color) and a PNG-in-ICO `favicon.ico`. `/favicon.ico` and `/icons/*` serve them
(or a generated letter icon) with a cache-busting `?v=` in metadata.

## SEO & i18n

### D-042 Status pages served by the proxy via fetch

In production, Next.js ignores the status of a proxy rewrite to a prerendered page, and a
404 status on a rewrite produces an empty error shell. The maintenance page (503), the
localized 404 and the admin "not allowed" page (404) are therefore fetched by the proxy
(an internal request marked with an HMAC header that skips the gate) and returned with
the right status. All three are static or cheap pages.

### D-043 Known routes and the localized 404

Unknown URLs get the static localized 404. The proxy compares the locale-less path
with the known routes published in the site state: registry page paths plus
`projectConfig.siteRoutes` (patterns like `/legal`, `/blog/:slug`, `/docs/*`) for routes
that aren't content pages. A catch-all `[...rest]` route remains as a fallback.

### D-044 Admin denial status

Admin pages stream, so a `notFound()` from a permission guard produces a 200 in production.
The proxy answers GET requests for admin-only sections with a real 404 when the signed,
current (version-checked) gate cookie says the role lacks the permission. Server-side
guards stay authoritative, and server actions are always checked by the action itself.

### D-045 Production-mode e2e locally

`pnpm e2e:prod` serves an isolated PGlite database over the Postgres protocol, builds,
starts `next start` and runs the whole Playwright suite. Several production-only behaviors
(static page statuses, streaming) were only caught this way.

### D-046 Per-locale SEO defaults in the schema

`definePage({ seo: { title, description, localized: { uk: { … } } } })` so untranslated
locales don't fall back to English titles in metadata, breadcrumbs and OG images.

## Analytics

### D-047 Cookieless analytics in our own tables

`public/a.js` (<1 KB, `lazyOnload`, never on admin pages, idempotent) sends
`navigator.sendBeacon('/api/collect')` on load and on client-side navigations. The
endpoint ignores bots, prefetches and (optionally) staff (signed gate cookie), stores a
visitor hash = SHA-256(daily salt | IP | UA | host) and never stores IPs. Salts of past
days are deleted. Days are UTC.

### D-048 Rollups + live "today"

Complete days are rolled up into `analytics_daily` (total, path, referrer, device, browser,
country). The Overview reads rollups for past days and aggregates today's raw events live.
Because the visitor hash rotates daily, "unique visitors" over a range is the sum of daily
uniques and "pages per visit" = views / daily uniques.

### D-049 Maintenance without a scheduler

Rollups and retention cleanup run lazily (claimed via `system_jobs`, at most hourly) after
beacons and when the Overview opens, and on demand via `/api/cron/maintenance`
(`Authorization: Bearer $CRON_SECRET`). `vercel.json` and
`netlify/functions/maintenance.mts` schedule it daily, but the app works without them.
Raw events older than the retention period are deleted; daily totals are kept.

## Managers & Security

### D-050 User guards as a pure function

`userChangeViolation()` encodes the §7 rules (no self delete/disable/demote, last active
admin protected) and is unit-tested. Server actions enforce it. Role and status changes
bump `session_version` so signed gate cookies with an old role stop working.

### D-051 TanStack Table v8

shadcn's DataTable pattern targets `@tanstack/react-table` v8. v9 (current) has a new
API, so we pin v8. **Revisit** when shadcn's pattern moves to v9.

### D-052 Connect Supabase runs in development only

The wizard tests credentials (pooled + direct Postgres, storage with the service role, anon
key), applies migrations via the direct URL, copies users/settings/content/revisions/media
(idempotent, FK order) and uploaded files, enables RLS on every app table with no
policies, creates a public-read bucket, and writes `.env.local`. In production the Security
page shows a read-only environment checklist, because hosting platforms own env vars and
secrets are never stored in the database.

### D-053 Invite emails as an extension point

`projectConfig.onUserInvited` is called after creating a user or resetting a password.
Without it, the temporary password is shown once in the admin (no email service needed).

## Hardening

### D-054 CSP: no nonces on static pages

Nonces require dynamic rendering, which would disable static generation. Site pages and
`/access` send a CSP with `script-src 'self' 'unsafe-inline'` (needed for Next.js's inline
runtime bootstrap) and strict everything else (`default-src 'self'`, no third-party origins,
`object-src 'none'`, `frame-ancestors 'none'`, `base-uri`/`form-action 'self'`). The
admin is dynamic and gets a per-request nonce + `'strict-dynamic'` policy from the proxy.
Experimental SRI was not adopted. **Revisit** when SRI is stable.

### D-055 Fonts are not preloaded; the demo uses one variable font

On simulated slow-4G mobile, font preloads competed with the LCP image (Performance 88 →
97 after the change). The demo uses Inter for headings and body (`--font-heading`
falls back to the body font); projects can add a heading font in `fonts.ts`.
`experimental.inlineCss` was measured and made LCP worse, so it is off.

### D-056 Bundle isolation is checked after every build

`pnpm check:bundles` reads the prerendered site HTML, follows every referenced chunk and
fails if admin-only code (Tiptap, Recharts, react-hook-form, Base UI, Better Auth, Drizzle,
admin modules) appears. It runs in CI.
