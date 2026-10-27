# Changelog

All notable changes to this template are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.8.1] - 2026-10-27

Patch release: safe `db:clone`, dependency fixes, small staging fixes. No breaking changes.

### Security

- **`db:clone` could empty the production database.** Run in the wrong direction on a
  developer computer (no `DATABASE_URL` in `.env`), it truncated the target before reading the
  source and outside a transaction. Now (D-098):
  - every production and staging deploy marks its database (`database_environment`);
  - the source must be migrated, hold users and settings and be marked `production` (or
    `--allow-any-source`);
  - a target marked `production` is always refused, whatever the local env says; an unmarked
    target only when empty;
  - the confirmation names both databases and what will be replaced;
  - truncate + copy run in one transaction (any failure rolls back); files are copied after
    the commit;
  - plain Postgres identity ignores the port (PgBouncer and the server are one database).
- Dependencies: `zod` 4.6.7 (memory exhaustion on oversized collections, also under
  `better-auth` 1.7.14), `nodemailer` 10.2.1 (address parser), `fast-uri` ≥ 3.1.9 via a pnpm
  override; `shadcn` (CLI) moved to `devDependencies`. `pnpm audit --prod`: no known
  vulnerabilities.

### Fixed

- Staging admin no longer says "Visible in Google": the Overview and the header say "Hidden
  from Google (staging)", and Settings → Google & sharing shows a note instead of the switch.
- No hydration mismatch for dates (Security, activity, sessions, requests, revisions, users,
  blog items): `<LocalTime>` renders UTC on the server and during hydration, then the
  browser's timezone. Overview chart days no longer shift by timezone.
- `db:migrate:deploy` refuses with a clear message behind a self-hosted PgBouncer in
  transaction mode (port 6432/6543 or `pgbouncer=true`) without `DIRECT_URL`
  (DEPLOYMENT.md § Other Postgres).

### Upgrade notes

- `pnpm install`, then deploy as usual: migration `0008_database_environment` runs on deploy.
- The first deploy of each environment writes its marker. Until then `db:clone` treats an
  unmarked database as unknown: refused as a source (unless `--allow-any-source`) and as a
  target unless it is empty. Deploy production and staging once before the next refresh.
- Self-hosted PgBouncer (transaction mode): set `DIRECT_URL`.

## [1.8.0] - 2026-10-27

Neon or Supabase, S3-compatible storage, staging and production.

### Added

- **Any Postgres, Neon recommended.** `DATABASE_URL` accepts Supabase, Neon (pooled or
  direct) or any Postgres; the provider is detected from the host and shown in Security →
  Database. Neon runs on the pooled URL (transaction mode) and derives the direct URL for
  migrations, `db:prepare` and the deploy lock; TLS is forced. With a non-Supabase database
  `AUTH_SECRET` is required in production (the error says how to generate it).
- **S3-compatible storage** (`STORAGE_DRIVER=s3`, `S3_*` variables): Neon Object Storage
  (per-branch, copy-on-write), Cloudflare R2, Hetzner, AWS. Files are served by `/api/media`
  (immutable cache, `nosniff`, sandbox CSP for SVG); optional `S3_PUBLIC_URL`. Staging on a
  non-branching store can read missing files from production with `STORAGE_READ_FALLBACK_URL`
  (read only).
- **Three environments** (`deploymentEnvironment()`): `main` → production, `staging` →
  staging (`projectConfig.stagingBranch`), pull requests → preview. Staging is never indexed,
  never loads tracking integrations, sends form emails only to `STAGING_MAIL_TO`, deletes
  nothing in maintenance and shows a "Staging" bar in the admin; previews show "Preview —
  read only".
- **Deploy lock:** `db:migrate:deploy` migrates and prepares under a Postgres advisory lock,
  so two deploys of one database never overlap.
- **`pnpm db:clone --from <url> --to <url>`** refreshes a staging database from production
  (Supabase/R2 setups; Neon: Reset from parent), with safety refusals and a confirmation.
- **Connect Neon** wizard (Security, developer mode) next to Connect Supabase: guide,
  connection check for both branches (pooled, direct, storage), optional "Copy my local
  content" (off by default), and a "Copy all" block per environment with its own
  `AUTH_SECRET`, with Netlify and Vercel instructions.
- Security → Database: environment, database size and images against the free-plan limit,
  with a warning from 80 %.
- `pnpm e2e:staging` (the production build started as staging) and a deploy-lock test on real
  Postgres in CI.

### Changed

- Migrations run on production, and on staging/previews only with
  `PREVIEW_DATABASE_ISOLATED=true` (unchanged flag; now documented for the staging branch).
- docs/TEAM.md uses `staging` instead of `dev`; DEPLOYMENT.md has Neon, environment and
  storage sections; the local-database banner says "Connect a database".

### Upgrading from 1.7.x

- **Supabase projects: nothing is required.** Storage stays Supabase unless you set `S3_*`.
- Optional: rename your test branch `dev` → `staging`, or keep it and set
  `stagingBranch: 'dev'` in `project.config.ts`; give it its own database with
  `PREVIEW_DATABASE_ISOLATED=true` for that branch only, and `STAGING_MAIL_TO`.
- Moving to Neon: follow DEPLOYMENT.md § Neon (new variables per environment; set
  `AUTH_SECRET`, otherwise everyone is signed out once).

## [1.7.2] - 2026-10-23

Security release: Next.js 16.4.1. No behavior changes.

### Security

- `next`, `@next/env` and `eslint-config-next` upgraded from 16.4.0 to **16.4.1**, which fixes:
  - **critical** GHSA-673q-mjm6-r5xr: remote code execution in `use cache` functions returning
    typed arrays (the template uses Cache Components, so every site was affected);
  - **critical** GHSA-2464-fhr4-w9xw: remote code execution in the Image Optimization API with
    SVG files (the template never enables `dangerouslyAllowSVG`; now covered by a unit and an
    e2e test);
  - **high** GHSA-p3m5-59mp-jv5r: denial of service in the App Router through Server Actions.
- Uploaded files served by the local storage driver (`/api/media/*`, development and
  self-hosting) keep their own sandboxing CSP: the site page CSP from `next.config.ts` no
  longer replaces it (SVG logos are served with `sandbox` again).
- CI: a blocking `pnpm audit --prod --audit-level=critical` step (the moderate-level audit
  stays non-blocking). docs/SECURITY.md describes how to respond to a framework advisory.

### Fixed

- An update from code ("Before update from code" and "Update from code" revisions) is listed
  in a stable order in the history.

### Upgrading from 1.7.x (and older)

**Update every project now:** `git fetch template --tags && git merge v1.7.2 && pnpm install`,
then redeploy.

## [1.7.1] - 2026-10-23

Team-friendly local databases and seeds.

### Added

- **Untouched content follows the code.** `content:sync` (every `pnpm dev`, every deploy)
  remembers which seed value each field was filled from; when a seed changes, fields nobody
  edited take the new value ("updated from code" in the output), edited fields are never
  touched. Works for pages, shared sections, globals, form texts and seed collection items, per
  language, and for seed images (a changed file is imported again). Each update is a restorable
  system revision; one activity-log entry per sync.
- **Reset to code defaults** in the editor (⋯ menu): the current language, all sections or one;
  lists the fields that will change; saved as a revision (undo from History) and logged. Not
  shown for collection items people created.
- **`pnpm db:reset [--yes]`**: deletes the local database, uploads and dev emails after a
  confirmation, migrates, seeds and prints the new dev admin. Refuses in production, with
  `DATABASE_URL`/`DIRECT_URL` set, or while `pnpm dev` holds the database.
- **docs/TEAM.md** (branches, local databases, seeds, online databases) and a pull request
  template (`.github/pull_request_template.md`).

### Changed

- Connect Supabase: a team hint next to "Copy my local content, images and users", and a note
  with what the online database already holds when it isn't empty (copying still only adds
  missing rows).

### Upgrading from 1.7.0

Run the migration (`pnpm db:migrate`; deploys do it). The first `content:sync` after upgrading
records the seed of every existing field and **changes nothing**; from then on, seed changes
reach the fields nobody edited. Fields whose value already differed from the seed at upgrade
time count as edited.

## [1.7.0] - 2026-10-16

Any language, editable interface texts, Settings → Integrations, `/storybook`.

### Added

- **Languages added by the admin** (Settings → General → Languages): a built-in list of ~100
  languages with a searchable picker. A new language starts as **Draft** (editable in the
  admin, hidden on the site; staff can preview it) and is shown after **Publish language**.
  The main language is always published; removing a language keeps its content. Only
  published languages are routed and appear in the switcher, sitemap and hreflang. Languages
  with a right-to-left layout or a script the fonts do not cover show "Check with your
  developer". The language switcher is now a dropdown with native names
  (`<LanguageSwitcher variant="tabs" />` keeps the old row). New project config:
  `fontScripts`, `privacyPath`.
- **Interface texts editable in the admin**: buttons, form messages, menu labels, pagination,
  404 and cookie texts. Edit them under "Interface texts" on the pages that show them
  (`uiTexts: [...]` on pages, globals, collections and forms; "Also on: …" like shared
  sections) or in Pages → Every page → Interface texts. A new language starts from the main
  language's texts, marked "Not translated". `pnpm content:check` verifies message keys and
  declarations. Cache tag `ui:{namespace}`.
- **Settings → Integrations** (admins only): Google Analytics 4, Google Tag Manager, Hotjar,
  HubSpot and Meta Pixel by ID (validated); email for forms with Resend or SMTP (presets for
  Brevo, Mailgun, Postmark, SendGrid, Gmail), "Send test email", status Off / On / Error.
  Credentials are stored encrypted (AES-256-GCM, key from `AUTH_SECRET`), never shown again.
  The Security status card lists integration problems.
- **Cookie banner**: a small card bottom-right with equal Accept / Decline, remembered for
  6 months, "Cookie settings" in the footer. Tools load only after Accept; the site CSP gets
  their origins at runtime (no rebuild). No banner when nothing needs consent.
- **Default recipients** in Settings → Requests for every form without its own list, and a
  warning (there and on the Overview) when email is connected but nobody receives requests.
- **`/storybook`** for staff: tokens (colors with contrast, fonts, text styles, spacing,
  radii, shadows) and a project slot `src/site/storybook.tsx` for components; everyone else
  gets the site's 404.

### Changed

- Email providers are resolved as `MAIL_PROVIDER=resend|smtp` in env → provider connected in
  Integrations → development files → none. Emails to default recipients are retried by the
  maintenance job after a provider is connected.
- The stored language settings are the source of truth; `supportedLocales` is the initial set.
- Site message files are read through the interface-texts catalog
  (`src/content/ui-texts.ts`); `src/site/i18n/request.ts` no longer imports them directly.

### Fixed

- The "Choose a new password" screen no longer loops after sign-in; a session that must choose
  a password lasts ~30 minutes.

### Security

- New exception to "no secrets in the database", only for integration credentials (D-092).
  Draft languages are visible to signed-in staff only. See docs/SECURITY.md.

### Upgrading from 1.6.x

Run the migrations (`pnpm db:migrate`; deploys run them in `db:prepare`): they add
`ui_texts`, `ui_text_revisions` and `integration_secrets`. Existing languages stay
**Published**; nothing else changes. To use the new features in a project:

1. Copy `src/content/ui-texts.ts` (register your `src/site/messages/<locale>.json` files and
   describe every key), read messages with `getTranslations` as before, and add
   `uiTexts: [...]` to the pages, globals, collections and forms that show them. Without
   declarations `pnpm content:check` fails for namespaces the site uses.
2. Replace `src/site/i18n/request.ts` with the template's version (messages come from
   `getSiteMessages`).
3. Add the `cookie` namespace to your messages and `Consent` to your root layout
   (`src/site/layout/consent.tsx`, `src/site/components/cookie-banner.tsx`) to use the
   banner; add `privacyPath` to `project.config.ts` and `fontScripts` if your fonts differ.
4. `MAIL_PROVIDER=dev` in env no longer hides a provider connected in Settings → Integrations.

## [1.6.0] - 2026-10-15

Shared sections inside pages, lists that are quick to edit, Session pooler.

### Added

- **Shared sections** (`defineSharedSection` + `useShared`, registered in `sharedSections`): a
  repeated section of page content stored once and shown in place on every page that uses
  it, in the admin and on the site. Badge "Shared" and "Also on: … Changes here update all N
  pages." in the editor; saving a page saves an edited shared section in the same
  transaction; conflicts name the section. Pages → Every page lists them with "Used on N
  pages". Cache tag `shared:{id}`. Demo: the CTA band on Home and About.
- **List layouts** (`f.list({ display })`, automatic by default): `tags` (chips), `lines`
  (stacked inputs), `rows` (a row per item) and `cards` (collapsed cards with a preview).
  Keyboard, paste and drag to reorder in all of them. Demo: blog post tags, Home highlights,
  Home numbers as rows.
- **Scalar lists**: `f.list({ of: f.text() })` → the site receives `string[]`.
- `content:check` warns about unused shared sections.

### Changed

- Connect Supabase, setup page and docs recommend the **Session pooler**
  (`…pooler.supabase.com:5432`); the transaction pooler is still accepted.
- Only sections and card lists collapse; other lists show every item.
- Dev `Server-Timing:` lines are logged per timed step (fixes a dev-only prerender error).

### Upgrading from 1.5.x

Nothing is required: existing pages, globals and lists keep working (lists get a layout
from their item shape). Optional: to move a section that repeats on several pages (or a
section of page content kept in a global) to a shared section:

1. Create `src/content/shared/<id>.ts` with `defineSharedSection({ id, label, fields, seed })`,
   using **the same id** as the existing section.
2. Replace the section in each page's `sections` with `useShared(<shared>)` (in site order),
   remove it from those pages' seeds, and add it to `sharedSections` in `src/content/index.ts`.
3. Run `pnpm content:sync` (or restart `pnpm dev`; deploys run it in `db:prepare`): the shared
   section adopts the values saved under that id on the first page that uses it (or in a
   global section with that id). Old values are kept as orphans.
4. Type views with `SharedSectionContent<typeof <shared>>`.

## [1.5.1] - 2026-10-14

One `DATABASE_URL` for any Supabase connection type.

### Changed

- `DATABASE_URL` accepts every Supabase connection string (shared pooler transaction or
  session, direct, dedicated). The type is detected; the session pooler uses one connection
  per instance with a short idle timeout.
- `DIRECT_URL` is optional: migrations use the transaction pooler's address in session mode
  (port 5432) when it is unset.
- `SUPABASE_URL` is optional: derived from the connection string. With Supabase only
  `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required.
- Connect Supabase: one "Connection string" field with the detected type and an
  IPv4 ✓ / IPv6 only ⚠ badge; "Copy all" lists `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  and the optional extras. The admin setup guide asks for two values.

### Fixed

- Deploys with a `db.<ref>.supabase.co` address (IPv6 only) on Netlify/Vercel now explain
  the problem in plain words (build log, Security status, Connect guide) and point to the
  shared pooler address. Passwords are never printed.

### Upgrading from 1.5.0

Nothing to do. Existing `DIRECT_URL` and `SUPABASE_URL` keep working (explicit values win);
you can remove them. On Netlify/Vercel make sure `DATABASE_URL` is the shared pooler address
(`…pooler.supabase.com:6543`).

## [1.5.0] - 2026-10-14

Fast navigation and a fix for custom admin paths.

### Fixed

- **A custom `adminPath` broke the admin** (`/<path>/login` was a 404). The proxy now
  rewrites the public admin path to the internal routes (CSP nonce, no-store and noindex
  kept); with a custom path `/admin/*` answers the site's 404 and `robots.txt` never shows the
  custom path. The demo uses `/stst-admin`.
- Team photos request the right image size on phones.

### Added

- Loading skeletons for every admin screen and a thin progress bar for pending navigations.
- `pnpm preview`: the production build on the local database, no env vars needed
  (`.next-preview`, independent of `pnpm dev`). `pnpm measure:nav`: click → feedback/content
  timings.
- `pnpm dev` pre-compiles the main site and admin routes after start.
- Dev-only `Server-Timing:` log lines for admin requests.
- E2E speed budget: warm navigations on a production build must take < 500 ms (CI).

### Changed

- The proxy serves its cached site state immediately and refreshes it in the background
  (`SITE_STATE_TTL_MS`, 15 s; 60 s in dev); the person who saved a change sees it at once.
  Other visitors see settings/publishing changes within the TTL.
- Admin settings and the session are read once per request; the Pages tree streams
  separately; activity labels load in two queries instead of one per item.
- Seed images are imported at most 2400 px wide.
- Connect Supabase and docs/DEPLOYMENT.md: pick the Supabase region of your hosting's
  functions, not the one closest to visitors.
- `pnpm e2e:prod` builds into `.next-e2e`; `check:bundles` honours `NEXT_DIST_DIR`.

### Upgrading from 1.4.0

1. Merge the template update. No database migration.
2. Set `adminPath` in `project.config.ts` to a custom path (`/<4 consonants>-admin`) and
   bookmark the new admin URL; `/admin` then answers 404.
3. In your own e2e tests use `admin('/…')` from `tests/e2e/support/admin.ts` and import
   `test`/`expect` from `tests/e2e/support/test.ts`.

## [1.4.0] - 2026-10-13

Deploy without setup, and fewer required variables.

### Added

- **Preview mode**: production without `DATABASE_URL` deploys and runs from the seed
  content (pages, globals, collection items, images from the build). Never indexable;
  forms say "This form isn't connected yet" (API: 503); analytics and cron off; `/admin`
  shows a step-by-step setup guide (Supabase + Netlify/Vercel). Logged at startup.
- `pnpm db:prepare` (run by `pnpm db:migrate:deploy` after migrations): Row Level
  Security, the media bucket, default settings and missing demo content.
- `pnpm e2e:preview`: E2E against a production build without any variables; CI job
  "Build without env".
- docs/DEPLOYMENT.md § Deploy in 5 minutes.

### Changed

- With Supabase only `DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are
  required. `NEXT_PUBLIC_SITE_URL` falls back to the Netlify/Vercel address; `AUTH_SECRET`
  is derived from `SUPABASE_SERVICE_ROLE_KEY` when unset (rotating the key then signs
  everyone out; an explicit `AUTH_SECRET` still wins).
- `pnpm db:migrate:deploy` skips with a clear message without `DATABASE_URL`.
- Connect Supabase, step 4: the 3 required variables + `DIRECT_URL`; site address,
  `AUTH_SECRET` and `CRON_SECRET` are optional extras.
- `next.config.ts` honours `NEXT_DIST_DIR` (separate build folders).

### Upgrading from 1.3.0

Nothing to do: no migration, and existing variables keep working. You may remove
`NEXT_PUBLIC_SITE_URL` (on Netlify/Vercel with the platform address) and `AUTH_SECRET`
(it is then derived from `SUPABASE_SERVICE_ROLE_KEY`; removing it signs everyone out
once).

## [1.3.0] - 2026-10-12

A simpler admin for clients: plain words, fewer things on screen, technical settings
behind a per-user developer mode.

### Added

- **Developer mode** per user (avatar menu and Account page): shows technical settings in
  a dashed "Developer settings" block and the local-database banner (development only).
- One accordion rule: first section open, others closed with a summary, Expand all /
  Collapse all, sections with errors open on save (editor, Account, Overview).
- **Settings tabs** (`?tab=`): General, Brand, Google & sharing, Requests, Site access;
  one save per tab and a sticky "You have unsaved changes" bar.
- Editor tab **Google & sharing** with a Google preview; noindex, canonical and share texts
  in a closed "Advanced" block.
- Overview: Visitors, Page views, New requests (link to the inbox); "More statistics"
  closed; one status line. Main navigation shows "N new" requests on Pages.
- Security: status card, signed-in devices, recent activity as sentences and a full
  **Activity** page (`/admin/security/activity`).
- **Connect Supabase** as a 5-step dialog with progress: "Where:" help per key, one-click
  "Prepare database", Vercel/Netlify instructions and **Copy all** (7 variables with fresh
  `AUTH_SECRET` / `CRON_SECRET`). The anon key is optional.
- Managers: role cards and an Edit dialog with 2FA, dates and every action.
- Site primitives `SectionIntro`, `SplitContainer`, `MediaFrame` and `Button`.

### Changed

- Client words in the UI (code names unchanged): Pause the site, Private site, Show the
  site in Google, Browser tab icon, Picture when shared in messengers, Image description,
  Same in all languages, Requests, Download as Excel, Activity, Signed-in devices. Pages
  sidebar groups: Pages, Blog & lists, Every page, Forms.
- Settings save through one action, `saveSettingsAction({ groups, localized })` (patch per
  group and locale, one transaction); the per-group settings actions were removed
  (internal API).
- Every screen uses the shared page header; form columns are at most ~760px wide.
- Organization data in JSON-LD defaults to the site name and logo.
- The Security page no longer shows the environment table.

### Fixed

- `/api/forms/submit` answers 413 for bodies over 64 KB before parsing, and 400 for
  malformed bodies.
- The editor title no longer truncates to a few letters next to the toolbar.
- Unit test setup timeouts under parallel load.

### Removed

- `@tanstack/react-table` (the Managers table is a plain table).

### Upgrading from 1.2.0

1. Merge the template update (core, scripts, tests, configs). Project files keep working;
   if your project copied the demo's hero/page-intro/CTA markup you can switch to the new
   site primitives (optional).
2. Run `pnpm db:migrate` (additive: `users.developer_mode`, default off).
3. Update e2e tests of your own that click old labels (see "Changed").

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
