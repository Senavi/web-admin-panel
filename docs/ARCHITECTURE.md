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

## Database

- `src/core/db/schema/*`: Drizzle tables. Migrations live in `src/core/db/migrations`
  (`pnpm db:generate` after schema changes; always commit them).
- `src/core/db/client.ts`: `getDb()` returns a process-wide singleton:
  - `DATABASE_URL` set → postgres-js (`prepare: false`, small pool) for Supabase's pooler;
  - otherwise in development → PGlite in `.data/pglite`, migrated and seeded on first use;
  - production without `DATABASE_URL` → startup error.
- `src/core/db/seed.ts`: idempotent seed steps (only insert missing data), run on first
  local start and by `pnpm db:seed`.
- CLI scripts (`scripts/*.ts`) run with `tsx --conditions=react-server` so they can import
  `server-only` modules, and load `.env*` files with `@next/env`.

## Auth

- Better Auth (`src/core/auth/server/config.ts`) with the Drizzle adapter, `twoFactor`
  plugin, DB-backed rate limiting and `nextCookies`. Sessions are DB-backed httpOnly
  cookies (`site.session_token`, `__Secure-` prefixed in production, SameSite=Lax);
  lifetime comes from Settings → Security policy.
- Server actions in `src/core/auth/actions.ts` are the only way to sign in, verify 2FA,
  change passwords or manage sessions. The HTTP handler exposes an allowlist (D-014).
- Guards (`src/core/auth/server/session.ts`): `requireUser`, `requirePermission` for pages,
  and `assertPermission` / `assertSignedIn` for actions. The permission map is
  `src/core/auth/permissions.ts`.
- On login a signed **site-gate cookie** (`site_gate`, HMAC with `AUTH_SECRET`, 12 h) is
  issued for the request proxy. `users.session_version` is bumped whenever sessions are
  revoked (password change, disable), which invalidates old gate cookies.
- Every auth event writes to `audit_log` (`AuditAction` constants).

## Request proxy & site gate

`src/proxy.ts` runs before every non-static request (Node.js runtime, **no DB driver**).

1. **Admin** (`/admin/**`): no session cookie → redirect to login with `?next=` (optimistic;
   pages verify the session). Adds `Cache-Control: no-store` + `X-Robots-Tag: noindex`.
2. **Ungated core routes**: `/api/**`, `/access`. Static files, `/_next/**`, `favicon.ico`,
   `/icons/*`, `robots.txt`, `sitemap.xml` don't match the proxy at all.
3. **Site**: the proxy loads the **site state** from `GET /api/site-state` (flags, locales and
   the active staff list). The endpoint requires an HMAC key derived from `AUTH_SECRET`, is
   backed by a `'use cache'` function tagged `settings` + `staff` (invalidated on save), and
   the proxy keeps it in memory for a few seconds per instance. If it can't be reached, the
   last known state is used.
4. **Staff detection** is cryptographic: the httpOnly `site_gate` cookie is an HMAC-signed
   `{uid, role, v, exp}` issued on login (and refreshed by the admin shell). It counts only if
   the signature and expiry are valid **and** `v` equals the user's current
   `session_version` in the staff list. Disabled users and old sessions are therefore rejected
   without a DB lookup, and forged or expired cookies never pass.
5. **Gate**: maintenance → rewrite to `/{locale}/maintenance-mode` with **HTTP 503** +
   `Retry-After` (staff bypass). Private mode → redirect to `/access?next=…` (staff bypass).
   Maintenance beats private mode. Indexing off or private mode → `X-Robots-Tag: noindex, nofollow`.
6. **Locale routing** (see i18n below). Staff get a `site_notice` cookie that the site's tiny
   `StaffNotice` component reads to show "Maintenance mode is on" on the static pages.

`/access` uses the same login form and actions as the admin (any active admin/manager).

## Content system

See docs/CONTENT_SCHEMA.md. In short: `src/content` defines pages (`definePage`),
collections (`defineCollection`), globals (`defineGlobal`) and forms (`defineForm`) with
`f.*` fields. `src/core/content` derives types, Zod validators, storage splitting (shared vs
localized), fallbacks, sync and route checks.

**One document engine (D-062).** Pages, globals, form texts and collection items are all
_documents_: a `DocumentTarget` (`{ kind: 'page' | 'global' | 'form' | 'item', … }`) is
resolved by `resolveDocument()` to its schema (sections), a `DocumentStore` (table binding:
page tables, or the `collection_item_*` tables), cache tags, audit target and public URL.
`saveDocument` (optimistic concurrency per row, revisions), `loadEditorData`, the revision
actions and the admin `DocumentEditor` work on any document.

**Data flow and cache tags.**

| Content         | Read on the site                 | Cache tags                                        | Invalidated by                      |
| --------------- | -------------------------------- | ------------------------------------------------- | ----------------------------------- |
| Page            | `getPageContent(id, locale)`     | `content:{id}`, `content:{id}:{locale}`           | saving the page (changed rows only) |
| Collection list | `getCollectionList(id, locale)`  | `collection:{id}:list`, `collection:{id}`         | saving/publishing/deleting any item |
| Collection item | `getCollectionItem(id, slug, …)` | `collection:{id}:{slug}`, `collection:{id}`       | saving it (old and new slug)        |
| Global          | `getGlobalContent(id, locale)`   | `global:{id}`                                     | saving the global                   |
| Form texts      | `getSiteFormConfig(id, locale)`  | `form:{id}`                                       | saving the form texts               |
| Site state      | proxy via `/api/site-state`      | `settings`, `staff`, every `collection:{id}:list` | settings, users, collection changes |
| Sitemap         | `/sitemap.xml`                   | `sitemap`, `settings`, collection list tags       | SEO changes, collection changes     |

Every read also carries `settings` (default locale, enabled locales).

## Local development database

`pnpm dev` (scripts/dev.ts) owns `.data/pglite`, migrates + seeds it and serves it over the
Postgres protocol on 127.0.0.1. Next.js workers and CLI scripts connect with postgres-js
(D-024). With `DATABASE_URL` set, `pnpm dev` just runs `next dev`.

## i18n routing

The proxy rewrites unprefixed URLs to the default locale (`/about` → `/en/about`
internally), passes prefixed non-default locales (`/uk/about`), redirects
`/en/about` → `/about`, and on the first visit to `/` redirects humans (not bots) to their
`Accept-Language` locale, remembering the choice in the `site_locale` cookie. Disabled
locales render the localized 404. Rules: `src/core/i18n/routing.ts`.

## Public site rendering

`src/app/(site)/[locale]/layout.tsx` is the site's root layout (own `<html>`, `site.css`,
fonts). Pages are prerendered for every enabled locale (`generateStaticParams`) and
revalidated through cache tags. No admin code, auth or DB driver reaches the client.

- **Collection items** are prerendered per published slug; slugs published later render on
  first request and are cached (ISR with Cache Components). Because a shell may already
  be streaming, the **proxy** decides 404 (unknown/draft/hidden slug), 308 (old slug) and
  404 for out-of-range `?page`, from the published slugs in the cached site state (D-066).
- **Collection lists** render per request (`instant = false`, the query decides the status)
  from cached data (D-065).
- **Staff previews** use Draft Mode with a cookie scoped to the item URL (D-067).
- **Forms** keep their page static: the hydrated form fetches a timing token from
  `/api/forms/token` and submits `/api/forms/submit` with `fetch`; without JavaScript the
  form posts natively to the same endpoint (D-069, D-070).

## SEO

- `buildPageMetadata` (src/core/seo/page-metadata.ts): page SEO (DB) → schema defaults (per
  locale) → site defaults, with the locale's title template, canonical (or override),
  hreflang for every enabled locale + `x-default`, Open Graph/Twitter (page image → site
  default image → generated `/og/{locale}/{page}.png`), and robots (page noindex, indexing
  off, private mode).
- `composeMetadata` serves pages and collection items (items: SEO → title/summary/image
  of the item → site defaults, `og:type=article`, hreflang only for locales showing it).
- `src/app/sitemap.ts`, `robots.ts`, `manifest.ts`: built from the registry and settings,
  cached with tags (`sitemap`, `settings`, content tags); published collection items are
  listed per locale where they are shown and indexable.
- JSON-LD: BreadcrumbList on every page, WebSite + Organization on the home page, the
  optional `structuredData` hook on a page definition; collection items get their article
  type (or hook) and Home → list → item breadcrumbs.
- Unknown URLs: the proxy serves the static localized 404 page with status 404 (D-043).

## Security headers & CSP

Static headers for every response come from `next.config.ts` (`src/core/security/headers.ts`).
Site pages get a CSP without nonces; admin requests get a nonce CSP from the proxy, and the
admin root layout passes the nonce to its providers. See docs/SECURITY.md.

## Maintenance

`runMaintenance()` (src/core/maintenance.ts) runs analytics rollups + retention and form
delivery retries + submission retention. The cron endpoint forces it; page views and the
Overview trigger throttled lazy runs.

## Testing

- Vitest unit tests (`tests/unit`) run against in-memory PGlite, including a Postgres
  wire-protocol test of the postgres-js driver.
- Playwright (`tests/e2e`): `pnpm e2e` against the dev server with an isolated database
  (`.data/e2e`), `pnpm e2e:prod` against a production build (`.data/e2e-prod`), CI against
  a Postgres service container.
