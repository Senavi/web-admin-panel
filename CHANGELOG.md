# Changelog

All notable changes to this template are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.0] - 2026-10-09

### Added

- **Collections** (`defineCollection`): repeatable items with their own URL (demo: Blog).
  Admin: Pages → Collections with a searchable, filterable table and an item editor (slug
  with suggestion and uniqueness check, Draft/Published, publish date, Preview, Delete,
  revisions, conflict detection). Site: `getCollectionList`, `getCollectionItem`,
  `createCollectionListRoute` (real `?page=N` URLs), `createCollectionItemRoute` (static
  params, metadata, JSON-LD, 308 for old slugs, staff Draft Mode preview), sitemap entries,
  analytics attribution. The proxy answers 404/308 for collection URLs before rendering.
- **Global content** (`defineGlobal` + `getGlobalContent`), edited in Pages → Site-wide.
  Demo: header phone, footer contacts, social links and legal line.
- **Forms** (`defineForm`): editable copy per locale, headless `useSiteForm` engine that
  works with and without JavaScript, spam protection (honeypot, signed minimum fill time,
  rate limits, optional Turnstile), inbox with filters, CSV export and retention, delivery
  by email (dev files / Resend / SMTP), signed webhook and Telegram with retries, Settings →
  Forms, Overview card. Demo: contact form.
- `f.email()` and `f.phone()` fields with `mailtoHref` / `telHref`.
- `createRegistry({ pages, collections, globals, forms })`; Pages sidebar groups.
- Permissions `forms.view` (managers), `forms.delete` and `forms.settings` (admins).

### Changed

- Pages, globals, form texts and collection items share one document engine (save,
  revisions, editor). `savePageAction` is now `saveDocumentAction` (internal API).
- The maintenance job also retries form deliveries and deletes old submissions.
- The Connect Supabase wizard copies collections and submissions.

### Upgrading from 1.1.0

1. Merge the template update (core, scripts, tests, configs); your `src/content`,
   `src/site`, `src/app/(site)` and `project.config.ts` keep working unchanged: the array
   form `createRegistry([…pages])` is still supported and nothing new is required.
2. Run `pnpm db:migrate` (additive: `collection_*` tables, `form_submissions`,
   `analytics_events.collection_id`) and `pnpm content:sync`.
3. Optional: add collections, globals or forms (docs/CONTENT_SCHEMA.md), set form env
   variables (docs/DEPLOYMENT.md § Forms) and Settings → Forms.
4. Page ids must be kebab-case and must not be `collections`, `site-wide` or `forms`.

## [1.1.0] - 2026-10-09

### Fixed

- CI: install pnpm (`pnpm/action-setup`) before `setup-node` caches the pnpm store.
- `pnpm typecheck` works on a fresh clone (`next typegen` before `tsc`).
- Private/maintenance mode fails closed: public pages return 503 when the site state is
  unknown instead of being served (D-057).
- Deploy builds migrate only in production contexts; previews need
  `PREVIEW_DATABASE_ISOLATED=true` and their own database (D-058).
- Admin: masked database URLs show `****` instead of `%E2%80%A2`; Recent activity and the
  audit log show user names and page labels instead of ids; breadcrumbs show page labels.
- CLAUDE.md no longer includes the Next.js agent notes twice.

### Added

- `projectConfig.csp`: validated third-party sources for the site CSP (D-059).
- `tokens:check` fails on classes without a matching token, e.g. `text-sm`, `shadow-xl`
  (D-060).

## [1.0.0] - 2026-10-08

### Added

- Foundation: Next.js 16 App Router scaffold, strict TypeScript, ESLint import
  boundaries, Prettier, Zod-validated environment, Vitest, Playwright, GitHub Actions CI.
- Database: Drizzle schema for auth, settings, content, revisions, media, analytics and
  audit log; PGlite (dev) and postgres-js (production) drivers; migrations and seed.
- Auth: Better Auth with roles (admin, manager), permission map, DB-backed login throttling,
  TOTP 2FA, forced password change, `pnpm admin:create`, Account page, signed site-gate cookie.
- Admin shell: shadcn sidebar (collapsible, sheet on mobile) filtered by role, header with
  breadcrumbs, status chips, View site, light/dark toggle and user menu, local database
  banner, admin 404, 2FA policy enforcement for admins.
- Content system: typed `definePage` / `defineSection` / `f.*` builders, registry, Zod
  validators, shared/localized storage with fallbacks, cached + tagged loaders,
  `content:sync`, `content:check`, safe rich text renderer.
- Design tokens: `tokens.css` (primitives → semantic → text styles), `fonts.ts`,
  generated `tokens.generated.ts`, `tokens:check` scanner.
- Demo site (Home, About, About → Team, Contact) in English and Ukrainian, locale routing
  in the proxy with first-visit language detection, storage adapters and image pipeline.
- `pnpm dev` serves the local PGlite database to all Next.js worker processes.
- Pages editor: searchable page tree with per-locale completeness, schema-generated forms for
  every field type (Tiptap rich text, image upload with per-locale alt text, reorderable
  lists), SEO tab with search preview and Open Graph fields, locale switch, revisions
  (preview + restore), optimistic concurrency, unsaved-changes guard, tag revalidation.
- Login form works without JavaScript (server action form).
- Settings: General, SEO defaults (per locale), Search & social, Branding (logos incl.
  sanitized SVG, favicon set, theme color), Site status (with confirmations), Analytics and
  Security policy, each saved independently and audited.
- Site gate: maintenance mode (HTTP 503 + Retry-After, project-overridable page, staff
  banner), private mode with `/access` sign-in, noindex headers, cryptographic staff
  detection in the proxy via the cached site-state endpoint.
- SEO: metadata chain with title templates, canonical, hreflang + x-default, Open Graph and
  Twitter cards, generated OG images, sitemap with alternates and lastModified, robots.txt
  and X-Robots-Tag tied to indexing/private mode, web manifest, JSON-LD, verification tags.
- i18n: per-locale SEO defaults, disabled locales return 404 and leave the sitemap, static
  localized 404 for unknown URLs (`projectConfig.siteRoutes` for non-content routes).
- `pnpm e2e:prod`: the full e2e suite against a production build.
- Analytics: cookieless beacon (<1 KB), daily-rotating visitor hash, bot/prefetch/staff
  filtering, platform geo headers, daily rollups, retention cleanup, cron endpoint with
  Vercel Cron and Netlify Scheduled Function configs.
- Overview dashboard: date range, KPIs with change vs previous period, traffic chart,
  top pages/referrers/devices/browsers/countries, site status and recent activity.
- Managers: user table (search, role filter), add user with a one-time temporary password,
  edit name/role, disable/enable, reset password, revoke sessions, delete, all with the
  self/last-admin guards; `onUserInvited` extension point.
- Security: database and storage health, environment checklist with masked values, all
  active sessions (revoke one/all), filterable audit log, Connect Supabase wizard (dev).
- Hardening: CSP (static pages / nonce-based admin) and security headers, upload pipeline
  tests, `pnpm check:bundles`, design-token acceptance test, mobile Lighthouse tuning,
  complete documentation (CUSTOMIZING, DEPLOYMENT, SECURITY).
