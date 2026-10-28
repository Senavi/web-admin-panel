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
**Superseded in 1.3 (D-077):** the Managers table became a plain table and the dependency
was removed.

### D-052 Connect Supabase runs in development only

The wizard tests credentials (pooled + direct Postgres, storage with the service role, anon
key), applies migrations via the direct URL, copies users/settings/content/revisions/media
(idempotent, FK order) and uploaded files, enables RLS on every app table with no
policies, creates a public-read bucket, and writes `.env.local`. In production the Security
page shows a read-only environment checklist, because hosting platforms own env vars and
secrets are never stored in the database.
**Updated in 1.3 (D-076):** the environment table is gone; the wizard is a 5-step dialog in
developer mode and the anon key is optional.

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

## Post-1.0 review

### D-057 Site state fails closed

The proxy has no database access and reads `/api/site-state`. If that request fails (cold
instance, database outage) and no last-known state is cached, public pages return `503`
with `Retry-After: 30`. The old fallback (default state = public) could expose a private
or maintenance-mode site during an outage. Staff checks in the admin also require a known
state. A successful state is cached for `SITE_STATE_TTL_MS` (3 s); after that the
last-known state is reused if a refresh fails.

### D-058 Migrations run only for production deploys

`pnpm db:migrate:deploy` (used by `vercel.json` and `netlify.toml`) migrates outside
Vercel/Netlify and on production contexts (`VERCEL_ENV=production`, Netlify
`CONTEXT=production`). Preview deploys skip migrations unless
`PREVIEW_DATABASE_ISOLATED=true` says they have their own database, so an unmerged
branch can never change the production schema.

### D-059 Project CSP sources live in `project.config.ts`

Third-party embeds and scripts need CSP sources, but `src/core/security/headers.ts` is
core. `projectConfig.csp` adds sources to the site CSP only (never the admin), and they
are validated at startup: no `*`, eval keywords or scheme-wide script sources.

### D-060 `tokens:check` rejects classes without a token

Tailwind's default theme is reset, so `text-sm` or `shadow-xl` compile to nothing and fail
silently. The check builds a catalog from `tokens.css` theme variables and `@utility`
blocks and flags color, shadow, radius, font, container, aspect, easing and spacing
classes with no matching token, plus all `leading-*`/`tracking-*` (text styles own them).

### D-061 `typecheck` runs `next typegen` first

`tsc` needs Next's generated route types (`PageProps`, `LayoutProps`), which normally only
exist after `next dev`/`next build`. `pnpm typecheck` runs `next typegen && tsc --noEmit`
so it works on a fresh clone and in CI.

## v1.2.0: collections, globals, forms

### D-062 One document engine for every kind of editable content

Pages, globals, form texts and collection items are all "documents": sections of fields
stored per locale with optimistic concurrency and revisions. The save engine
(`saveDocument`), editor loader (`loadEditorData`), revision actions and the admin
`DocumentEditor` work on a `ContentDocument` resolved from a `DocumentTarget`
(`src/core/content/document.ts`). Each kind only provides its schema, a `DocumentStore`
(table binding), cache tags, audit target and public URL. New kinds don't copy editor or
save logic.

### D-063 Collection items use their own tables, bound through the shared store

`collection_items` (slug, status, publish date, version) plus `collection_item_content`,
`_seo` and `_revisions` mirror the page tables, so one `DocumentStore` factory
(`stores/table-store.ts`) serves both: pages and items share save, conflict detection and
revision code. Item fields are stored as one internal section (`item`) so the section-based
value helpers work unchanged; site loaders return them flat (`item.content.title`). Old
slugs are kept in `collection_slug_redirects`; `collection_seed_log` makes `content:sync`
create each seed item once (deleted or renamed seed items don't come back).

### D-064 Collection data on the site: cached loaders, narrow tags

`getCollectionList` / `getCollectionItem` are `'use cache'` functions tagged
`collection:{id}:list`, `collection:{id}:{slug}` and `collection:{id}`. Saving an item
invalidates its old and new slug, the list and the sitemap only. Date sort runs in SQL; a
field sort loads the visible set and sorts in memory (fine for thousands of items).

### D-065 List pages render per request

`/blog?page=N` must answer 404 beyond the last page, which needs the query before
rendering. List routes export `instant = false` and read `searchParams` at the top; the data
stays cached, so the render is cheap. Item pages stay prerendered per slug.

### D-066 The proxy decides 404/308 for collection URLs

With Cache Components and Partial Prefetching, a slug that wasn't prerendered is served
from the static shell first, so `notFound()` or `permanentRedirect()` inside the page can
no longer change the 200 status (Next.js streaming contract). The proxy has no database, so
`/api/site-state` (cached, tagged with every collection list) now carries each collection's
published slugs per locale, its old-slug redirects and page size. The proxy answers unknown
or hidden slugs with the static 404 page, old slugs with a 308 and out-of-range `?page`
with 404, before rendering. Changes reach the proxy within its state TTL (3 s). The state
grows with the number of items (fine for thousands; document if a project expects more).

### D-067 Staff previews use Draft Mode, scoped to the item URL

The admin "Preview" link goes through `/api/preview` (signed-in staff with `pages.view`
only; the redirect target comes from the database). It enables Next.js Draft Mode but
rewrites the cookie's `Path` to the item URL, so other pages and link prefetches keep
using the cache, and the item route renders the preview fully dynamically. The item route
also re-checks the session before showing drafts. Next.js 16.4 still logs an
"Unexpected cache miss" warning for the previewed URL (Draft Mode bypasses caches); it is
harmless.

### D-068 Globals live in the page tables under `global:<id>`

A global is a page without a route or SEO, so it reuses the page tables, store, editor and
revisions with a namespaced key (`global:site`). Page ids are validated kebab-case, so the
`:` keeps the namespaces apart without a migration. `getGlobalContent` is cached with the
tag `global:{id}`; header/footer components read it, so saving updates every page that
rendered it. Contact values got `f.email()` / `f.phone()` (validated, with `mailtoHref` /
`telHref`), and social profile links use `f.link()` so only safe URL schemes are stored.

### D-069 Public forms post to a route handler, not a server action

Site pages are prerendered (Cache Components + Partial Prefetching). Two server-action
behaviours break forms there: the no-JavaScript POST is answered by resuming the static
shell, which drops `useActionState`'s form state; and with JavaScript the action response
carries the cached page as Flight data, so the client re-renders the page and resets the
form. Public forms therefore use one endpoint, `POST /api/forms/submit`:

- before hydration (or without JavaScript) the `<form>` posts natively (browser validation;
  answers: redirect to the thank-you page, or a minimal page for confirm/errors/success);
- once hydrated, `useSiteForm` validates inline and submits the same endpoint with `fetch`
  (`Accept: application/json` → JSON state), so the page never reloads.

Admin actions stay server actions (admin pages are dynamic).

### D-070 Spam protection without third parties

Honeypot field; signed minimum fill time (HMAC token, 3 s – 24 h) fetched by the hydrated
form from `/api/forms/token`, so pages with forms stay fully static (a streamed per-request
token would never reach the form without JavaScript, and arrived too late with it).
Without JavaScript the first submit returns a small confirm page carrying a fresh token.
Missing or too-fast/forged tokens: confirm step or silent drop. DB-backed rate limits reuse
the sign-in throttle (`login_throttle`, keys `form:<id>` and `form:<id>:ip:<hash>`): 5 per
visitor per 10 minutes, 200 per form per hour. Optional Cloudflare Turnstile via
`projectConfig.forms.turnstile` adds its CSP sources automatically.

### D-071 Delivery is per destination and never blocks the visitor

Submissions are stored first; email (dev files / Resend / SMTP via nodemailer), signed
webhook (`X-Signature: sha256=<hex HMAC>`, https or localhost only) and Telegram are
delivered independently and recorded per destination on the submission (shown in the
inbox). Failures are retried by the maintenance job (5 attempts within 7 days); retention
(Settings → Forms, default 12 months) deletes old submissions. Secrets only in env; the
email body is plain text; nothing from a submission is logged.

## v1.3: simpler admin

### D-072 Developer mode is a per-user display preference

`users.developer_mode` (boolean, default off, additive migration 0004) is switched in the
avatar menu or on the Account page by an audited server action. When off, technical
settings are **not rendered** (one shared `DeveloperSection`: dashed border, "Developer
settings"); the local-database banner shows only in development with it on. It is not
access control: every action still checks its permission on the server, so an admin
without developer mode can call the same actions, and a manager with it on gains nothing.

### D-073 One accordion rule for the whole admin

In a list of sections only the first starts open; a standalone collapsible starts
closed. Closed headers show a short summary (first values, "N items"). Lists offer
"Expand all / Collapse all"; a section with a validation error opens on save. One
component (`admin/components/layout/accordion.tsx`) implements it for the editor,
Account, Overview ("More statistics") and the editor's "Advanced" block.

### D-074 Settings are tabs with one save per tab

General, Brand, Google & sharing, Requests and Site access (`?tab=`). Each tab is one form
and one save through `saveSettingsAction({ groups, localized })`: partial values are merged
into the stored group, the whole group is validated, everything is written in one
transaction and an audit entry is written per changed group/locale with the changed keys
only. Field errors come back keyed like the form (`groups.<group>.<field>`). A sticky bar
shows "You have unsaved changes". "Add the site name to page titles" maps to the title
template (`%s — {siteName}` or `%s`); the template itself is a developer setting.

### D-075 Client words in the UI, code names unchanged

The UI says Pause the site, Private site, Show the site in Google, Browser tab icon,
Picture when shared in messengers, Image description, Same in all languages, Requests,
Download as Excel, Activity, Signed-in devices. Code, settings keys, permissions and audit
action ids keep their names (maintenance, privateMode, indexing, submissions, audit), so
no data migration is needed. Client-facing descriptions avoid HTTP codes and header names.

### D-076 Security shows a status, not an environment dump

The Security page shows one status ("Everything works" or problems in plain words:
database, file storage, email), signed-in devices and recent activity as sentences with
a link to the full Activity log (`/admin/security/activity`, filters). The environment
table was removed: required production variables already fail startup (env schema).
Database, storage and email details and Connect Supabase are developer-mode only;
Connect Supabase remains development-only (server-enforced). Its hosting step generates
`AUTH_SECRET` and `CRON_SECRET` in the browser (Web Crypto, 32 bytes) when "Copy all" is
clicked; they are copied to the clipboard and never sent to the server. Hosting
instructions live in one data file (`admin/components/security/hosting-guides.ts`).

### D-077 Managers: role cards and one Edit dialog

Two role cards explain what Admin and Manager can do. The table shows name + email, role,
last sign-in and Edit; 2FA status, the added date and every action (reset password, sign
out everywhere, disable, delete) are in the Edit dialog. The guards (D-050) are unchanged.

### D-078 Form submissions are size-limited before parsing

`/api/forms/submit` refuses bodies over 64 KB with 413: first by `Content-Length`, then by
counting streamed bytes, so an oversized body is never buffered or parsed in full.
Malformed bodies get 400 instead of a server error.

## v1.4: deploy without setup

### D-079 Preview mode: production without DATABASE_URL

A fresh import on Netlify/Vercel deploys with zero variables. `isPreviewMode()` =
production and no `DATABASE_URL` (`src/core/preview/mode.ts`, pure, used by the env
schema, the proxy and scripts). The site renders from code only: default settings with
every supported language on, page/global/collection seeds through the normal fallback
chain, and seed images served from the build (`/api/seed-assets/<file>`, optimized by
`next/image`; media ids are deterministic UUIDs of the file name so they pass the same
validation as uploads). It is never indexable (robots disallow, `X-Robots-Tag: noindex`,
empty sitemap), the proxy serves pages instead of failing closed (there is no private
content), forms answer 503 "This form isn't connected yet", analytics and cron are
no-ops, every `/admin/*` URL shows one public setup guide (rewrite to `/admin/setup`,
nonce CSP kept) and database-backed API routes answer 404. `AUTH_SECRET` is not needed:
a fixed public key signs the proxy's internal requests, because nothing secret exists
(no accounts, sessions, forms or drafts). Adding `DATABASE_URL` and redeploying turns it
off. A server logs "Preview mode: no DATABASE_URL" at startup; `db:migrate:deploy` skips
with a clear line.

### D-080 Three variables with Supabase

`DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are enough.
`NEXT_PUBLIC_SITE_URL` falls back at runtime to the platform address (Netlify `URL`, or
`DEPLOY_PRIME_URL` outside production; Vercel `VERCEL_PROJECT_PRODUCTION_URL`, or
`VERCEL_URL` for previews) and is required only when none is known. `AUTH_SECRET` falls
back to HKDF-SHA256(`SUPABASE_SERVICE_ROLE_KEY`, info `site-starter/auth-secret/v1`, 48
bytes): one less secret to manage, at the cost that rotating the service key signs
everyone out. An explicit `AUTH_SECRET` still wins, and development only ever uses the
generated dev secret. The Connect dialog copies the 3 variables + `DIRECT_URL`, plus the
optional ones the person ticks.

### D-081 Deploys prepare the database

`pnpm db:migrate:deploy` runs migrations and then `pnpm db:prepare`: Row Level Security
on every app table (no policies; the app connects as the owner) and the public-read
`media` bucket when Supabase is configured, then default settings and missing demo
content (`runSeed`, idempotent: missing rows and fields only, deleted seed items are not
recreated). So a fresh Supabase project is safe and complete after one redeploy, and new
tables from later migrations get RLS automatically. The first admin is still created with
`pnpm admin:create` (no public sign-up).

## v1.5: fast navigation

### D-082 Custom admin path via a proxy rewrite

The admin's app routes live under the internal `/admin` folder; `projectConfig.adminPath`
(e.g. `/stst-admin`, from now on always custom per project) is the only public URL. The
proxy rewrites `/<adminPath>/*` to `/admin/*` (same nonce CSP, `no-store`, `noindex`
headers), every link and redirect uses `adminHref()`, and with a custom path any request to
`/admin/*` gets the site's 404. `robots.txt` lists `/admin` (never the custom path), so the
real address is not advertised. The demo uses a custom path so every e2e run (and CI)
exercises it; tests build URLs with `admin()`.

### D-083 Admin loading states, and React's reveal throttle

Every admin route segment has a `loading.tsx` skeleton (shared pieces in
`admin/components/layout/skeletons.tsx`; the Overview's sits in the `(overview)` route group
so it doesn't wrap other screens; the Pages tree streams in its own Suspense boundary) and a
thin top progress bar shows while a navigation is pending. A click now reacts in tens of
milliseconds. Trade-off: once a fallback is shown, React reveals the content no earlier than
~300 ms later (its Suspense fallback throttle), so on a fast local build "final content" is
≈350 ms instead of ≈100 ms; on real hosting, where the server usually needs longer than that
anyway, the skeleton is pure gain. Tests wait for streamed chunks to settle
(`tests/e2e/support/test.ts`): until React moves them, a chunk's content briefly exists twice
(once inside a hidden `<div id="S:…">`).

### D-084 Proxy site state: stale-while-revalidate

The proxy keeps the site state per instance and serves it immediately; when it is older than
`SITE_STATE_TTL_MS` (15 s; 60 s in development) a background refresh starts. Only a cold
instance waits (and still fails closed). Changes reach other visitors within the TTL (plus
one request). The person who changed something (settings, staff, published items) gets a
short-lived `site-state-v` cookie with the change time; the proxy reloads the state before
answering them if its copy is older, so they see their change at once. Only recent,
non-future values are honoured, and concurrent reloads are coalesced.

### D-085 Per-request admin data and a speed budget

The session lookup is deduplicated per request (React `cache`), as are the settings the
layout, the guards and the page all read (`getRequestSettings`). Independent queries run in
parallel; the activity labels no longer query once per item. Hot lookups already had
indexes, so no migration. In development `timed()` logs a `Server-Timing:` line per timed step
(`SERVER_TIMING=true` enables it in production; since 1.6 per step, because `after()` reads
the clock while Next prerenders). `pnpm preview` serves a production
build on the local database (`.next-preview`, never touching `pnpm dev`'s cache), `pnpm dev`
pre-compiles the main routes after start, and `navigation-speed.spec.ts` fails a production
build whose warm client navigations (4 site, 4 admin pages) take 500 ms or more. Seed images
are capped at 2400 px on import, and the Supabase region should match the hosting's
functions region (every query crosses that distance).

## v1.5.1: one DATABASE_URL

### D-086 One connection string for any Supabase connection type

Netlify and Vercel connect over IPv4 only, but Supabase's `db.<ref>.supabase.co` addresses
(direct, and the paid dedicated pooler) are IPv6 unless the paid IPv4 add-on is on; people
paste them and deploys fail. `src/core/db/connection-info.ts` (pure, also used in the
browser) detects the type from host, port and user: shared pooler transaction (6543) /
session (5432), direct, dedicated, other Postgres. From it:

- the runtime keeps `prepare: false`; on the shared session pooler each instance holds at
  most one connection with a 5 s idle timeout, so serverless instances don't exhaust the
  project's session pool;
- migrations and scripts use `DIRECT_URL` if set, else the shared transaction pooler's
  address in session mode (same host and user, port 5432), else `DATABASE_URL`;
- `SUPABASE_URL` is derived (`postgres.<ref>` user or `db.<ref>` host); an explicit value
  wins. Required with Supabase: `DATABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`;
- a network error (ENETUNREACH, EHOSTUNREACH, ENOTFOUND, ETIMEDOUT, connect timeout…) on a
  direct/dedicated address becomes one plain message pointing to the shared pooler, in the
  build log (`runScript`), the Security status card, the Connect guide's check, and as a
  startup warning on Netlify/Vercel. Connection strings in messages are masked.

The Connect guide has one "Connection string" field with the detected type and an
IPv4 ✓ / IPv6 only ⚠ badge, and writes/copies only `DATABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` (plus optional extras); stale `DIRECT_URL`, `SUPABASE_URL`,
`STORAGE_DRIVER` and bucket lines it wrote before are removed from `.env.local`.

## v1.6: shared sections, easy lists

### D-087 Shared sections are stored once, shown in every page

A repeated section of page content used to become a global, which removed it from the pages
it appears on in the admin. `defineSharedSection()` + `useShared()` (in the page's `sections`,
site order) keep it in place. Storage reuses the page/global engine: one document under the
key `shared:<id>` in `page_content` (`_shared` + per locale), with its own versions,
revisions (`page_revisions`) and audit entries (`shared:<id>:<locale>`). A page's own
document stores only its own sections (`ownSchema`); the editor shows all sections in order
(`displaySections`) and the save action writes the page and every shared section edited on
it in **one transaction** (`saveDocumentIn`), so a conflict on the shared section rolls the
page back too and is reported by section name; validation errors keep their
`content.<section>.<field>` paths. The site loader merges each shared section's content under
its id (typed like a section) and tags the page `shared:<id>`, so one save revalidates every
page that uses it. Page revisions cover the page's own sections; a shared section's history
is in its own editor (Pages → Every page). Globals stay for layout chrome. On the first sync a
shared section adopts values saved under its id on a page that uses it or in a global
section, so existing projects can move a section without retyping.

### D-088 Lists choose their editor from the item shape

`f.list` gets `display` (`tags`, `lines`, `rows`, `cards`), chosen automatically when omitted:
one short text/select → tags; one text up to ~120 chars → lines; 2–3 inline fields → rows;
images, rich text, textareas or more fields → cards. Only sections and cards collapse. Scalar
lists (`of: f.text()`) are stored as `{ _key, value }` items, so storage, validation,
revisions, per-item errors and reordering stay the same as object lists; the site receives
plain arrays (`string[]`). An explicit `display` that can't show the item shape fails at
definition time. Keyboard: tags (Enter, Delete, Alt+←/→), lines (Enter, Backspace on empty,
Alt+↑/↓), rows and cards (move buttons); every layout also supports drag to reorder and
paste of many values.

### D-089 Session pooler is the recommended Supabase connection

On Netlify the shared transaction pooler (6543) caused errors in testing; the shared session
pooler (5432) works. The Connect guide, setup page and docs point to Connect → Session pooler
and show "Recommended" for it; the other types are still accepted with their IPv4/IPv6
badges, and the runtime keeps one connection per instance on the session pooler (D-086).

## v1.7: any language, editable interface texts, integrations

### D-090 Languages are chosen by the admin; the stored settings are the truth

`src/core/i18n/languages.ts` is a master list of ~100 languages (BCP 47 code, English and
native name, direction, writing system). `project.config.ts` keeps `supportedLocales` only as
the initial set and the fallback default. Settings → General → Languages stores two lists:
`enabledLocales` (**Published**: routed, in the switcher, sitemap and hreflang) and
`draftLocales` (**Draft**: editable in the admin, hidden on the site). The main language is
always published and cannot be removed; a language is never both. Adding, publishing,
unpublishing or removing a language never touches another language's content: removing only
leaves both lists, the content stays and the language can be added again. v1.6 settings
parse unchanged (no drafts; the enabled locales stay published). The proxy's site state
carries `draftLocales` and `supportedLocales` = published + draft (the URL prefixes it
knows): a draft prefix answers the static 404 unless a valid staff session is present, in
which case the page renders (so the [locale] layout accepts any selected locale and relies
on the proxy for the draft gate). Everything per language in the admin (editors, page tree
statuses, settings SEO, interface texts) offers all selected languages, drafts marked. A
language outside `projectConfig.fontScripts` (default Latin + Cyrillic; `Latx` = Latin
extended) or a right-to-left one shows "Check with your developer: fonts/layout may need
changes for this language". The switcher is a dropdown with native names
(`variant="tabs"` keeps the old look). `privacyPath` in the project config adds the privacy
link to the cookie banner.

### D-091 Interface texts: files are defaults, edits are stored per language

The small site texts live in `src/site/messages/<locale>.json` (defaults, registered with
their admin descriptions in `src/content/ui-texts.ts`). Edits are stored in `ui_texts`
(namespace, language, flat `{ "errors.required": "…" }`, version) holding **only** texts that
differ from what the language would show anyway. The merged text is: the language's edit →
the language's file → the main language's edit → the main language's file → English, so a new
language starts from the main language's texts ("Not translated") while a language with its
own file is not overridden by the main language's edits. Pages, globals, collections and forms
declare `uiTexts: ['blog', …]`; their editors show an "Interface texts" accordion with
"Also on: …" (same idea as shared sections, D-087), and Pages → Every page → Interface texts
lists all of them. Saving is its own action (a namespace belongs to several pages): optimistic
version check, previous state kept in `ui_text_revisions` (20 per namespace/language), audit
`ui:<namespace>:<locale>`, cache tag `ui:{namespace}`. Placeholders (`{date}`) must be kept and
no other braces are allowed. `content:check` reads the site code and fails for a message key
missing in `en.json`, a namespace that is used but not declared by any page/global/
collection/form, or a text without an admin description.

### D-092 Integration credentials are stored encrypted (exception to "no secrets in the database")

Until now no secret lived in the database. Clients connect email themselves, so API keys and
SMTP passwords entered in Settings → Integrations are stored in `integration_secrets` as
AES-256-GCM: key = HKDF-SHA256 of the auth secret (`AUTH_SECRET`, or the value derived from
the Supabase service key) with its own `info` label, a random IV per value, the secret's name
as authenticated data. The browser only ever sees `••••1234`, "Replace" and "Remove";
decryption happens server-side when a mail is sent; audit entries name the secret, not the
value; only admins (`integrations.manage`) can change them. If the auth secret is rotated the
values become unreadable: the card asks to enter them again and Security shows a problem
instead of crashing. Database credentials and the auth secret itself stay in env.

### D-093 Consent-based scripts; the site CSP follows the published state

Google Analytics 4, Tag Manager, Hotjar, HubSpot and Meta Pixel are configured by ID (not
secrets) in Settings → Integrations. While any is on, a small banner (bottom-right,
`src/site/components/cookie-banner.tsx`, texts in the `cookie` interface texts) asks for
consent; scripts load with `next/script` only after "Accept" (the choice lives 6 months in a
cookie; the footer's "Cookie settings" reopens it; declining after accepting reloads the page).
With nothing on there is no banner and nothing loads. The origins a tool needs are in the
published site state (`integrationCsp`) and the proxy builds the site CSP from them on each
response, so enabling a tool needs no rebuild. The static CSP in `next.config.ts` stays the
fallback; admin CSP is untouched.

### D-094 Email: environment, then Integrations, then development files

`resolveMailConfig` picks the provider: `MAIL_PROVIDER=resend|smtp` in env (shown read-only as
"Set on the server"), else the provider connected in Settings → Integrations (Resend, or SMTP
with presets for Brevo, Mailgun, Postmark, SendGrid and Gmail), else development files
(`MAIL_PROVIDER=dev` or any non-production run), else none. Env `dev` is therefore a default
for development, not an override of a connected provider. Settings → Requests gets **Default
recipients** used by every form without a list of its own; a form's own list stays an
override. A failed delivery because email is not connected does not use up retry attempts, so
submissions saved before a provider was connected are sent by the retry job once one is. A
warning appears in Settings → Requests and on the Overview when email is connected but nobody
receives requests; Security lists integration problems (unreadable credentials, a failed
test email).

## v1.7.1: team-friendly local databases

### D-095 Seed provenance: never-edited content follows the code

`content:sync` used to fill only what was missing, so after a teammate fixed a seed text, every
database where that page already existed kept the old text, the live site included. Now each
content row (page, shared section, global, form texts, seed collection item; per language and
`_shared`) has a `content_seed_state` row: `"section.field"` → hash of the seed value last
applied. On sync, a field whose stored value still hashes to that value was never edited, so it
takes the new seed; any other value is an edit and is kept. Hashes ignore list item keys and
use the same normalization as the editor's save, so saving a page without touching a field
doesn't make it look edited. The newest seed hash is always recorded, which also makes the
first sync after upgrading a no-op (fields without a recorded hash are only recorded). Seed
images carry the SHA-256 of their file (`media.seed_asset_hash`): a changed file is imported
again (the old image stays in the library without the seed name) and untouched image fields
move to it through the same rule. Updates are written as system revisions (author "Update from
code", plus "Before update from code" when the document had no history), so they can be
restored; the audit log gets one summary entry per sync, not one per field. Interface texts need
nothing: only edits are stored, the message files are read at runtime (D-091).

"Reset to code defaults" is the manual counterpart: a server action (Zod, `PagesEdit`, audit,
conflict check) that saves the code defaults (language seed → main language seed → field
defaults) for one language, for all own sections or one section (a shared section is reset in
its own document), as a normal revision. Items people created have no seed and no reset.

`pnpm db:reset` restarts a local database from the code. It refuses production and any
`DATABASE_URL`/`DIRECT_URL` (a remote database is never reset; a local Postgres is not what the
command manages) and stops while `pnpm dev` holds the PGlite lock. The Connect Supabase wizard
now says that a team leaves "Copy my local content" off and shows what the online database
already holds (copying only adds missing rows, D-052).

## v1.8: Neon or Supabase, S3 storage, staging and production

### D-096 Any Postgres, Neon first; S3-compatible storage

Supabase's free plan (2 active projects per account, paused after a week) doesn't fit an
agency with many sites and a staging copy of each. Neon's free plan has 100 projects with
database branches and S3-compatible Object Storage that branches with them (copy-on-write: a
staging branch sees production's files, its writes and deletes stay on staging), so it is the
recommended provider; Supabase keeps working unchanged.

- `connection-info.ts` detects the provider from the host (`DatabaseProvider`: Supabase,
  Neon, other Postgres). Neon's pooled host (`-pooler`, PgBouncer transaction mode) is the
  runtime URL: `prepare: false`, no session settings, no session advisory locks. The direct
  host (without `-pooler`) is derived for migrations, `db:prepare`, `db:clone` and the deploy
  lock unless `DIRECT_URL` is set, so one variable is enough. TLS is forced for Neon
  (`ssl: 'require'`), whatever `sslmode` says.
- Without a Supabase service key there is nothing to derive `AUTH_SECRET` from: with any other
  database it is required in production, and the env error says how to generate it. Each
  environment has its own secret; integration credentials copied between environments become
  unreadable and show "Re-enter the key" (D-092), which is intended.
- Storage drivers: `s3` (new), `supabase`, `local`. `s3` signs with SigV4 through `aws4fetch`
  (fetch-based, a few KB; the AWS SDK would add megabytes to every function for four calls)
  and is chosen when `S3_*` variables are set (an explicit opt-in that also beats a Supabase
  database), else Supabase for a Supabase database, else local (refused in production). Files
  are served by `/api/media/<key>` (immutable one-year cache, so the CDN answers repeat
  requests; `nosniff`; sandbox CSP for SVG logos); `S3_PUBLIC_URL` lets raster images load
  straight from a public bucket. Neon requires path-style requests (`S3_FORCE_PATH_STYLE`,
  default true).
- Staging on a non-branching store (R2, Supabase) after a copy of production: a read-only
  fallback (`STORAGE_READ_FALLBACK_URL`, the production bucket's public URL) serves files
  missing from staging's bucket; it only ever does GET without credentials, so it can't
  write or delete production files.
- Security → Database shows the provider, the environment, database size and image total
  against the provider's free-plan limits, with a warning from 80 % (status card).

### D-097 Environments: production, staging, preview

`deploymentEnvironment()` (`src/core/deployment/environment.ts`) is the only place that reads
platform variables: Vercel `VERCEL_ENV` + `VERCEL_GIT_COMMIT_REF`, Netlify `CONTEXT` +
`BRANCH`, with `projectConfig.stagingBranch` (default `staging`). `DEPLOYMENT_ENVIRONMENT`
overrides it (self-hosting, tests); the value detected at build time is inlined
(`SITE_BUILD_ENVIRONMENT`) because functions don't always see the platform's build variables.

- **Migrations** (`migrationDecision`): production always; staging and previews only with
  `PREVIEW_DATABASE_ISOLATED=true` (set for the staging branch only, so a missing staging
  database can never mean "migrate production from an unmerged branch"); pull-request
  previews have no database (preview mode). The 1.7 behavior of the flag is kept.
- **Deploy lock:** `db:migrate:deploy` holds a session advisory lock (`pg_try_advisory_lock`,
  polled, 10 minutes max) over the direct connection while it migrates and runs `db:prepare`,
  so two deploys of one database never overlap; ending the session releases it, so a
  crashed build never blocks the next. Tested on real Postgres in CI (PGlite has one session).
- **Staging safety** (its database is often a copy of production), applied at the source so
  every consumer follows: `settingsForEnvironment()` turns indexing and tracking integrations
  off in the settings the site reads (robots, sitemap, metadata, `X-Robots-Tag`, consent
  scripts, the site CSP); the proxy answers `robots.txt` (disallow) and `sitemap.xml` (empty)
  itself on staging, because those are prerendered at build time;
  `destinationsForEnvironment()` sends form emails only to `STAGING_MAIL_TO` and turns
  webhooks and Telegram off (without `STAGING_MAIL_TO` nothing is emailed: the spec's
  "signed-in staff" would include the client's accounts on a copy of production, so the team
  lists its addresses explicitly); maintenance deletes nothing. The admin shows the stored
  settings unchanged and a "Staging" bar; previews show "Preview — read only".
- **Refreshing staging:** Neon's "Reset from parent"; elsewhere `pnpm db:clone` (truncates and
  copies the same tables as Connect Supabase: no sessions, analytics or audit log), which
  refuses deploys/CI, a target equal to the source (pooled and direct URLs of one database
  count as the same) and this setup's own `DATABASE_URL` unless it is a staging setup. Data
  never moves from staging to production.
  _Superseded in part by D-098: the URL checks alone let a reversed `db:clone` empty
  production._

## v1.8.1: safe `db:clone`

### D-098 Databases say which environment they are; `db:clone` trusts that, not `.env`

**Context.** Testing v1.8.0 against a real Postgres, `pnpm db:clone --from <empty staging>
--to <production> --yes` on a developer computer emptied production: the target was truncated
before the source was read and outside a transaction, and the only guard compared the target
with the computer's own `DATABASE_URL`, which a developer computer doesn't have. For plain
Postgres the identity also included the port, so a PgBouncer address and the server looked
like two databases.

**Decision.**

- **Environment marker** in every deployed database: table `database_environment` (one row:
  `environment`, `database_identity`, `marked_at`), written by `db:prepare` from
  `deploymentEnvironment()` on production and staging deploys, by the Connect Neon/Supabase
  wizards (`production`) and by `db:clone` on its target (`staging`). Other environments leave
  a database unmarked. It is not in `COPY_TABLES`, so it never travels with data.
- **Production is sticky** on its own database: a staging deploy that prepares a database
  marked production with the same identity (a misconfigured `DATABASE_URL`) keeps the marker
  and prints a WARNING. A marker written for another database (Neon "Reset from parent", a
  restored backup) is a copy and is re-marked. Nothing in the app ever writes production over
  staging except a production deploy or a Connect wizard.
- **`db:clone` order:** URL checks (deploy/CI, same database) → read the source (all
  migrations of this code, every copied table, at least one user and the settings row, marked
  `production` unless `--allow-any-source`) → read the target (refused when marked
  `production`, with no override; when marked anything but `staging`; when unmarked and not
  empty) → confirmation naming both markers and what will be replaced → migrate the target →
  `TRUNCATE` + copy + marker in **one transaction** on the direct connection, re-checking the
  marker inside it → media files after the commit.
- **Identity** for plain Postgres is host + database name; the port is ignored (PgBouncer on
  6432 and the server on 5432 are one database). Refusing two genuinely different local
  servers on one host is the safe failure.
- `db:migrate:deploy` refuses when the migration URL still looks like a transaction pooler
  (port 6432/6543 or `pgbouncer=true`) and `DIRECT_URL` is missing.

**Consequences.** Until an environment's first deploy with v1.8.1, its database is unmarked:
`db:clone` refuses it as a source (unless `--allow-any-source`) and accepts it as a target only
when empty. Tested in CI against Postgres 17 (`tests/unit/db-clone-postgres.test.ts`): wrong
direction refused, unmigrated source refused, mid-copy failure rolled back, happy path.

## v1.8.2: wrong-database warning

### D-099 The admin warns when an environment uses the wrong database

**Context.** With D-098 a staging deploy on the live database only prints a WARNING in the
build log. On Netlify a variable with one value for all contexts also reaches branch deploys,
so the staging admin showed the purple "Staging — test database" bar while people edited the
live site.

**Decision.** Each server instance reads the database marker once (cached promise; a failed
read is retried) and compares it with `currentEnvironment()` (`detectDatabaseMismatch()`,
pure): a staging site on a database marked production, or the live site on one marked
staging, with the same identity. Then a red bar replaces the environment bar on every admin
page, for every staff role, and the Security status card and the Overview show it as a
problem. Unmarked databases (before the first v1.8.1 deploy), copied markers (identity
differs: Neon reset, restored backup), preview mode and local PGlite show nothing.

**Not blocking.** Saving stays possible: locking everyone out of the admin during the fix is
worse than a loud warning. The marker changes only with a deploy, which starts new instances,
so the once-per-instance read is current.
