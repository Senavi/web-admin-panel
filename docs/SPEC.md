# Build Prompt: Reusable Next.js Site Starter with Custom Admin Panel

> **How to use:** put this file into an empty repository as `docs/SPEC.md`, open Claude Code in that repo and say:
> *"Read docs/SPEC.md fully and build the project it describes. Start in plan mode."*

---

## 0. Your role and how to work

You are a senior full-stack engineer building a **reusable starter template**: a Next.js website skeleton with a production-grade custom admin panel. This repository will be published on GitHub and cloned into many future client projects. AI agents will later replace the demo site with real designs and adapt the admin through configuration. **Code quality, clear boundaries and documentation matter as much as features.**

Working rules:

1. **Start in plan mode.** Read this whole spec, then produce an implementation plan split into the phases from section 16. Only then start coding.
2. **Verify current versions and APIs before using them.** Before each phase, check the current stable versions and official docs of Next.js, React, Better Auth, Drizzle ORM, PGlite, next-intl, shadcn/ui, Tailwind CSS and the Supabase JS client. Do not rely on memory for APIs that change between major versions (e.g. `middleware.ts` vs `proxy.ts`, caching APIs, `params` being async). Use what the current docs recommend.
3. **Commit after each phase** with a clear message. Keep the build green at every commit.
4. **Ask the developer only when blocked** by a decision this spec doesn't cover and that is expensive to reverse. Otherwise pick the conventional option and record it in `docs/DECISIONS.md`.
5. **Prove each phase works**: typecheck, lint, tests, and for UI, run the app and check it in a browser (Playwright). Don't mark a phase done on "it should work".
6. **No hardcoding, no spaghetti.** Small modules, single responsibility, typed boundaries, no copy-pasted logic, no magic strings (use constants/enums), no `any`.
7. All code, comments, UI text and docs are in **English**.

---

## 1. Product summary

The repository is a **site starter** consisting of:

- **Core** (template-owned, reused unchanged across projects): admin panel, auth, database layer, content system, settings, SEO, i18n infrastructure, analytics, storage, security.
- **Project layer** (replaced per project): the public website (pages, sections, components, theme), the content schema for its pages, and project config.
- **Demo site**: a small example website that exercises every core feature so the template can be tested end to end. It will be deleted and replaced in real projects.

Target hosting: **Vercel and Netlify** (both must work, no platform-locked features). Database: **local embedded Postgres (PGlite) in development → Supabase (Postgres + Storage) in production.**

---

## 2. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js (latest stable, App Router), React, TypeScript `strict` | Server Components by default |
| Package manager | pnpm | Current Node LTS, pinned in `.nvmrc` and `engines` |
| Styling | Tailwind CSS | Site and admin use separate style entry points |
| Admin UI | shadcn/ui, **default styling**, dark theme by default + light toggle (`next-themes`) | Use shadcn `Sidebar`, `Chart`, `DataTable` patterns, `Sonner` for toasts |
| ORM | Drizzle ORM + drizzle-kit migrations | One Postgres dialect everywhere |
| Local DB | PGlite (embedded Postgres, data in `.data/pglite`, gitignored) | Development only |
| Production DB | Supabase Postgres via `postgres` (postgres-js) | Use the pooler in transaction mode for serverless (`prepare: false`); direct URL for migrations |
| Auth | Better Auth with the Drizzle adapter (verify current API) | Email + password, roles, sessions, TOTP 2FA, DB-backed rate limiting |
| Validation | Zod | All inputs, env vars, content |
| i18n (site content) | next-intl | Admin UI itself is English only |
| Storage | Adapter interface: local filesystem (dev) / Supabase Storage (prod) | |
| Charts | shadcn charts (Recharts) | Admin only |
| Testing | Vitest (unit), Playwright (e2e) | |
| Lint/format | ESLint (Next config + strict TS rules), Prettier | |
| CI | GitHub Actions: install → typecheck → lint → unit → build → e2e | |

Don't add other heavy dependencies without a reason recorded in `docs/DECISIONS.md`. Nothing from the admin bundle may ship to public site routes.

---

## 3. Repository structure and boundaries

Use this layout (adjust details if current Next.js conventions require it, but keep the core/project split):

```
.
├─ docs/
│  ├─ SPEC.md                ← this file
│  ├─ ARCHITECTURE.md
│  ├─ CONTENT_SCHEMA.md      ← how to define pages/sections/fields
│  ├─ CUSTOMIZING.md         ← step-by-step: adapting the template to a new project
│  ├─ DEPLOYMENT.md          ← Vercel, Netlify, Supabase setup
│  ├─ SECURITY.md
│  ├─ DESIGN_TOKENS.md       ← colors, typography, spacing tokens and how to map a design to them
│  └─ DECISIONS.md
├─ CLAUDE.md                 ← rules for AI agents working in this repo (see §14)
├─ CHANGELOG.md
├─ project.config.ts         ← PROJECT: name, supported locales, default locale, brand, admin path
├─ src/
│  ├─ app/
│  │  ├─ (site)/[locale]/... ← PROJECT: public routes (demo now)
│  │  ├─ admin/              ← CORE: /admin routes
│  │  ├─ access/             ← CORE: private-mode login page for the site
│  │  ├─ api/                ← CORE: auth, collect (analytics), media, cron, maintenance
│  │  ├─ robots.ts, sitemap.ts, manifest.ts, icon routes ← CORE
│  │  └─ not-found.tsx etc.
│  ├─ core/                  ← CORE logic (no UI)
│  │  ├─ db/                 (client factory, drizzle schema, migrations, pglite/postgres drivers)
│  │  ├─ auth/               (Better Auth config, session helpers, requireRole, permissions)
│  │  ├─ content/            (field builders, page registry types, loaders, validation, sync)
│  │  ├─ settings/
│  │  ├─ seo/                (metadata builders, JSON-LD helpers, hreflang)
│  │  ├─ i18n/
│  │  ├─ analytics/
│  │  ├─ storage/            (adapter interface + local + supabase)
│  │  ├─ security/           (headers, rate limit, sanitization, audit log, upload validation)
│  │  ├─ site-gate/          (maintenance + private mode logic)
│  │  └─ env.ts              (zod-validated env, server-only)
│  ├─ admin/                 ← CORE: admin UI components, hooks, layouts
│  ├─ site/                  ← PROJECT: site components, sections, layout, maintenance page
│  │  └─ theme/              ← PROJECT: tokens.css + fonts.ts — the ONLY place with visual values (§12)
│  └─ content/               ← PROJECT: page registry, section schemas, seed defaults
├─ scripts/                  ← CLI: admin:create, content:sync, content:check, db tasks
├─ tests/ (unit + e2e)
├─ netlify.toml, vercel.json (only if needed), .env.example
```

Rules:

- **`src/core` and `src/admin` must never import from `src/site`.** The only way core learns about the project is through `project.config.ts` and the registry exported from `src/content`. Enforce this with an ESLint import-boundary rule.
- Server-only modules import `server-only`. Secrets never reach client bundles.
- Every core file that a project might reasonably want to change gets an extension point (config option, slot, or hook) instead of requiring edits. Document the extension points in `CUSTOMIZING.md`.

---

## 4. Content system (the heart of the template)

Pages are **fixed** (defined by developers in code); admins and managers edit their **content and SEO**, not their structure. The admin editor is **generated from a schema**, so adapting the admin to a new project means writing schemas, not admin code.

### 4.1 Schema definition API

Provide typed builders in `src/core/content`:

```ts
// src/content/pages/home.ts  (PROJECT)
export const homePage = definePage({
  id: 'home',
  path: '/',                 // localized routing handled by i18n layer
  label: 'Home',
  parent: null,
  sections: [
    defineSection({
      id: 'hero',
      label: 'Hero',
      fields: {
        eyebrow: f.text({ label: 'Eyebrow', max: 40 }),
        title:   f.text({ label: 'Title', required: true, max: 120 }),
        body:    f.textarea({ label: 'Body', max: 400 }),
        image:   f.image({ label: 'Hero image', localized: false, required: true }),
        cta:     f.link({ label: 'Button' }),
      },
    }),
    defineSection({
      id: 'features',
      label: 'Features',
      fields: {
        items: f.list({
          label: 'Features', min: 1, max: 6,
          of: { icon: f.select({ options: [...] }), title: f.text(), text: f.textarea() },
        }),
      },
    }),
  ],
  seo: { title: 'Home', description: '...' }, // defaults
});
```

Field types: `text`, `textarea`, `richText` (limited, sanitized; Tiptap or similar in admin), `image` (with per-locale alt text), `link` (label + href + external flag), `list` (repeatable group with min/max and reordering), `boolean`, `number`, `select`, `color` (optional). Each field supports `label`, `help`, `required`, constraints, and `localized` (default `true`; non-localized values are shared across locales).

Page registry (`src/content/index.ts`) exports all pages; `parent` builds the page tree (pages and sub-pages).

### 4.2 Typed reading on the site

- `getPageContent(pageId, locale)` returns content **fully typed from the schema** (TypeScript inference, no manual types).
- Missing localized values fall back to the default locale, then to seed defaults.
- Reads are cached and tagged (`content:{pageId}`, `content:{pageId}:{locale}`, `settings`). Saving in admin revalidates only affected tags. Public pages stay statically rendered/ISR, not dynamic per request.

### 4.3 Storage and sync

- DB stores content as validated JSONB per `(page_id, locale)` plus a `_shared` record for non-localized fields. Separate `page_seo` per `(page_id, locale)`.
- `pnpm content:sync` seeds missing pages/fields from schema defaults **without overwriting edited content**, and reports orphaned fields (removed from schema) without deleting them.
- `pnpm content:check` verifies every registered page has a route and every route under `(site)` that renders content is registered; fails CI otherwise.
- Zod validators are derived from the schema and used both in admin forms and server actions.
- Keep the last 20 revisions per `(page, locale)` with author and timestamp; admins/managers can view and restore.
- Optimistic concurrency: saving fails with a clear message if someone else saved since the editor loaded.

---

## 5. Data model (Drizzle)

At minimum (add what the auth library requires):

- `users` (id, name, email unique, role `admin|manager`, status `active|disabled`, mustChangePassword, lastLoginAt, timestamps), plus auth tables (sessions, accounts, verifications, two-factor).
- `settings` (single typed row or typed key/value with Zod) and `settings_localized` (locale, meta title template, description, OG defaults).
- `page_content`, `page_seo`, `page_revisions`.
- `media` (id, storage key, mime, size, width, height, blurhash/placeholder, uploadedBy, createdAt).
- `analytics_events` (ts, path, pageId, locale, visitorHash, referrerHost, deviceType, browser, country nullable) with proper indexes, and `analytics_daily` rollups.
- `audit_log` (actor, action, target, diff summary, ip hash, ts).
- `rate_limits` (if the auth library doesn't provide DB-backed storage).

All migrations are generated by drizzle-kit and committed. The same migrations run on PGlite and Supabase.

---

## 6. Database modes and "Connect Supabase"

### 6.1 Driver selection
- If `DATABASE_URL` is set → postgres-js against Supabase.
- If not set and `NODE_ENV !== 'production'` → PGlite in `.data/pglite`, auto-migrated and seeded on first run.
- In production without `DATABASE_URL` → fail fast with a clear error. PGlite never runs in production (serverless filesystems are ephemeral).

### 6.2 Local DB banner
While PGlite is active, show a persistent banner at the top of **every admin screen including the login page**: *"Using local database. Data is stored on this machine only."* with a **Connect Supabase** button. The banner disappears once the app runs on Supabase.

### 6.3 Connect Supabase wizard (development)
Multi-step dialog:
1. Inputs: Supabase project URL, anon key, service role key, pooled `DATABASE_URL`, direct `DIRECT_URL`. Links to where to find each in the Supabase dashboard.
2. **Test connection** (DB + Storage) with clear error messages.
3. **Run migrations** on Supabase.
4. **Migrate data** (optional, checked by default): users, settings, content, revisions, media records; upload local files to a Supabase Storage bucket.
5. **Secure the database**: enable Row Level Security on every app table with no policies (the app connects server-side; the public Data API must expose nothing). Create the storage bucket with public read and server-only write.
6. Write the variables to `.env.local` (never commit them) and tell the developer to restart the dev server.

### 6.4 Production
The wizard cannot write env vars on Vercel/Netlify. In production it shows a read-only checklist of required env vars with copy buttons and short instructions for both platforms, plus live connection status. **Secrets are never stored in the database.**

---

## 7. Auth, roles and permissions

- Roles: **Admin** (everything) and **Manager** (Overview, Pages incl. content and page SEO, own Account). Managers cannot open Managers, Settings or Security.
- Central permission map in `src/core/auth/permissions.ts`. Every server action, route handler and admin page calls `requireRole(...)` / `requirePermission(...)` **on the server**. Hiding UI is not access control.
- No public sign-up. First admin is created by `pnpm admin:create` (interactive CLI) or, in development only, from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`. Never ship default credentials.
- Passwords: memory-hard hashing, min length 12, checked against a common-password list.
- Sessions: httpOnly, Secure, SameSite=Lax cookies; expiry and rotation; all sessions revoked on password change or user disable.
- Login rate limiting per IP and per email (DB-backed, works on serverless); generic error messages; lockout with backoff.
- Optional TOTP 2FA per user (admins can be required to use it via a setting).
- New users get a temporary password shown once and must change it on first login (no email service required; leave an extension point for invite emails).
- Guards: you cannot delete/disable/demote yourself; the last active admin cannot be removed or demoted.

---

## 8. Admin panel

Path `/admin` (configurable in `project.config.ts`). Fully responsive, keyboard-accessible, default shadcn look, dark by default with a light/dark toggle in the header. `noindex` + `Cache-Control: no-store` on all admin responses.

### 8.1 Login (`/admin/login`)
Centered card: email, password, submit; 2FA step when enabled; error states; local DB banner when applicable. Redirect back to the requested admin page after login.

### 8.2 Shell
- Left sidebar (shadcn Sidebar, collapsible, sheet on mobile): **Overview, Pages, Managers, Settings, Security**, and **Sign out** at the bottom. Items are filtered by role.
- Header: breadcrumbs, "View site" link, theme toggle, user menu (Account, Sign out).
- **Account** page (all roles): change name, password, 2FA, own active sessions.
- Status chips in the header when Maintenance or Private mode is on, so nobody forgets.

### 8.3 Overview (Admin + Manager)
Clear visual hierarchy, top to bottom:
1. Date range control (Today, 7d, 30d, 90d) applying to the whole page.
2. **Primary KPIs** (large cards): Unique visitors, Page views, Pages per visit, each with change vs the previous period.
3. **Main chart**: visitors and page views over time.
4. **Secondary panels** (two-column grid): Top pages, Top referrers, Devices, Browsers; Countries if the platform provides a geo header.
5. **Tertiary**: Site status card (DB mode, maintenance, private mode, indexing, enabled locales) and Recent activity from the audit log.

Analytics collection:
- A tiny script (<1 KB, loaded after idle, never in admin) sends `navigator.sendBeacon('/api/collect')` on page view.
- No cookies, no raw IPs stored. Visitor hash = SHA-256(daily rotating secret salt + IP + user agent + host); the salt is deleted after the day ends.
- Filter bots (user-agent detection), prefetches, and optionally logged-in staff (setting).
- Geo: read the country from platform headers through a small abstraction (Vercel and Netlify headers), null otherwise.
- Rollups into `analytics_daily`; retention period setting (default 13 months) with cleanup.
- Maintenance tasks (rollups, cleanup) run lazily and through a protected `/api/cron/maintenance` endpoint (`CRON_SECRET`). Provide configs for Vercel Cron and Netlify Scheduled Functions, but the app must work correctly without them.

### 8.4 Pages (Admin + Manager)
- Secondary sidebar next to the main one: searchable **tree of all pages and sub-pages** from the registry, with per-locale completeness indicators.
- Selecting a page opens the editor:
  - Header: page label, path, **locale dropdown** (enabled locales), "View page" link, unsaved-changes indicator, **Save** and **Discard**.
  - Tabs: **Content** and **SEO**.
  - **Content**: one collapsible card per section; fields auto-generated from the schema; list fields with add/remove/reorder; image fields with upload, preview, replace, remove and per-locale alt text; non-localized fields marked "Shared across languages".
  - **SEO**: meta title and description with character counters and a search-result preview, OG title/description/image, canonical override, per-page `noindex` toggle.
  - Revisions drawer: list, preview, restore.
- Unsaved-changes guard on navigation. Toast on save. Server-side validation errors mapped to fields.
- Saving revalidates the affected cache tags so the live page updates within seconds.

### 8.5 Managers (Admin only)
Data table of users: name, email, role, status, 2FA, last login, created. Search and filter by role. Actions: add user (temporary password shown once), edit name/role, disable/enable, reset password, revoke sessions, delete (with confirmation). Guards from §7.

### 8.6 Settings (Admin only)
Grouped cards, each saved independently:
- **General**: site name, **enabled locales** (multi-select from `supportedLocales` in `project.config.ts`), default locale.
- **SEO & Metadata** with a **locale dropdown**: title template (e.g. `%s | Brand`), default description, default OG image, Twitter/X handle, Organization/WebSite JSON-LD fields, search engine verification codes (Google, Bing).
- **Branding**: logo (light and dark variants), favicon upload (generate the needed sizes: ICO, PNG icons, Apple touch icon), theme color.
- **Site status** (with explanation text and confirmation dialogs):
  - **Maintenance mode** + optional message.
  - **Search engine indexing**.
  - **Private mode**.
- **Analytics**: exclude staff visits, retention period.
- **Security policy**: require 2FA for admins, session lifetime.

### 8.7 Security (Admin only)
- **Database**: current mode, masked host, connection status, Connect Supabase wizard (dev) / env checklist (prod).
- **Storage**: adapter in use, bucket, status.
- **Environment**: list of required and optional env vars with set/missing status and masked values. Never reveal full secrets.
- **Sessions**: all active sessions across users, revoke one or all.
- **Audit log**: filterable list of admin actions and login attempts (success/failure).

---

## 9. Site gate: maintenance, private mode, indexing

Implement in `src/core/site-gate` plus the request interceptor (`proxy.ts` or `middleware.ts` depending on the current Next.js version). The interceptor must stay lightweight and run on both Vercel and Netlify: **no direct DB driver in it**. Read site flags from a small cached internal source (e.g. a tagged, CDN-cacheable endpoint revalidated on settings save) and verify sessions cryptographically (signed cookie/token). Document the approach in `ARCHITECTURE.md`.

Always excluded from gating: `/admin/**`, auth API routes, `/access`, static assets, `robots.txt`.

- **Maintenance mode ON**: public visitors get the maintenance page with **HTTP 503** and `Retry-After` (never 404, so search engines don't drop pages). The project can provide its own page in `src/site/maintenance`; otherwise a clean default from core is used. Logged-in staff can browse the real site with a small banner "Maintenance mode is on".
- **Private mode ON**: unauthenticated visitors are redirected to `/access` (simple login page in a neutral style). Only users who exist and are active in the admin user list can log in. After login they reach the originally requested URL. A forged or expired cookie must not grant access. Private mode **forces noindex** regardless of the indexing toggle.
- **Precedence**: maintenance beats private mode for visitors; staff sessions bypass both.
- **Indexing OFF** (or private mode ON): `robots.txt` disallows all, every response carries `X-Robots-Tag: noindex, nofollow`, pages render `<meta name="robots" content="noindex,nofollow">`, sitemap returns empty or 404. **Indexing ON**: normal robots rules (admin and API always disallowed), sitemap available, per-page `noindex` respected.

---

## 10. SEO (core, works for every project)

- `generateMetadata` for every page from: page SEO (DB) → page defaults (schema) → site defaults (settings), using the title template.
- Canonical URLs, `hreflang` alternates for all enabled locales plus `x-default`.
- Open Graph and Twitter cards with fallbacks; dynamic default OG image route if none uploaded.
- `sitemap.xml` generated from the registry × enabled locales, with alternates and `lastModified` from content timestamps, excluding `noindex` pages.
- `robots.txt` per §9. `manifest.webmanifest` from settings. Favicons/icons from uploaded branding.
- JSON-LD helpers: Organization, WebSite, BreadcrumbList, plus a per-page hook for custom schema.
- Semantic HTML in the demo site (`header`, `nav`, `main`, `section` with headings, `footer`), one `h1` per page, correct heading order, descriptive alt text.
- Proper 404 page (localized) with status 404.
- Search engine verification meta tags from settings.

---

## 11. i18n

- `project.config.ts` declares `supportedLocales` (all locales the project can have) and a fallback default. Admins pick **enabled** locales and the **default** locale in Settings.
- Routing via next-intl: default locale without prefix, others prefixed (`/`, `/uk/...`). Disabled locales return 404. Locale detection from `Accept-Language` only on the first visit to `/`, with a cookie to remember the choice; no forced redirects for crawlers.
- Static generation for all enabled locales; changing enabled locales revalidates affected routes.
- Site UI strings (buttons, labels not managed in admin) live in message files per locale in `src/site/messages`.
- `<html lang>` and `dir` set correctly.

---

## 12. Design tokens (single source of truth for the site's look)

Every visual value of the public site lives in **one place**: `src/site/theme/`. Components never contain raw values. Changing a token must restyle the whole site with no other file touched.

### 12.1 Files
- **`src/site/theme/fonts.ts`**: the only place where fonts are declared (`next/font`, local or Google), each exposed as a CSS variable.
- **`src/site/theme/tokens.css`**: the only file with raw values, written as Tailwind theme variables (verify the current Tailwind syntax, e.g. `@theme` in v4). It defines:
  - **Colors** in two layers:
    - **primitives**: brand palette scales, e.g. `--color-brand-500`;
    - **semantic tokens** that reference primitives: `background`, `foreground`, `surface`, `surface-muted`, `muted-foreground`, `border`, `primary`, `primary-foreground`, `accent`, `success`, `warning`, `danger`, `focus-ring`, overlay.
    - Components use **only semantic names**. If the design has a dark theme, it overrides semantic tokens only.
  - **Typography**:
    - font families `--font-heading`, `--font-body`, `--font-mono`, mapped to the variables from `fonts.ts`;
    - **text styles as composite tokens**: for each style (display, h1–h6, lead, body-lg, body, body-sm, caption, overline, label, button, nav), define **font size, line height, letter spacing, font weight** (and family where it differs);
    - responsive sizes are part of the token (`clamp()` or per-breakpoint values), never decided inside components.
  - **Layout & shape**: spacing scale, section vertical rhythm, container max widths and gutters, breakpoints, radii, border widths, shadows, z-index layers, aspect ratios.
  - **Motion**: durations and easings.

### 12.2 Usage
- Each text style is exposed as **one class** (e.g. `text-h1`, `text-body-sm`) and/or a typed `<Heading level variant>` / `<Text variant>` component. Components never combine size, leading and tracking ad hoc.
- Section spacing and containers come from shared layout primitives (`<Section>`, `<Container>`) that read tokens.
- TypeScript consumers that need token values (OG image generation, charts, canvas) read them from a single typed module derived from the same source. Pick one direction (CSS → TS or TS → CSS), automate it and document it. No second copy maintained by hand.

### 12.3 Enforcement
- **Not allowed in `src/site/**` outside `src/site/theme/`:**
  - hex/rgb/hsl/oklch colors;
  - px/rem font sizes, line heights or letter spacing;
  - arbitrary Tailwind values (`text-[17px]`, `bg-[#123456]`, `tracking-[0.02em]`, `leading-[1.3]`, `p-[13px]`);
  - inline `style` with visual values.
- Add `pnpm tokens:check` (ESLint rule or scanner script) that fails on violations; run it in CI.
- The admin uses shadcn's own theme variables in a separate stylesheet and is not affected by site tokens.

### 12.4 Docs
Write `docs/DESIGN_TOKENS.md` covering:
- the token list and naming conventions;
- how to extract tokens from a design (screenshots, Figma, existing CSS) and map them to primitives → semantic tokens → text styles;
- how to add a new color, text style or spacing value.

The demo site is the reference implementation of this system.

## 13. Security and performance requirements

### Security
- Zod-validated env in `src/core/env.ts`; the app fails at startup on missing/invalid required vars.
- Every mutation is a server action or route handler that checks auth + permission, validates input with Zod and writes an audit log entry.
- Origin checks on route handlers that mutate; rely on built-in server action protections and don't weaken them.
- Security headers on all responses: HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'` (via CSP). A CSP that works with static rendering (no inline scripts on the site; nonces only where rendering is dynamic anyway, e.g. admin). Document it.
- Uploads: MIME allowlist + magic-byte check, size limits, random file names, image dimension limits, SVG allowed only for logos and sanitized. Images re-encoded or stripped of metadata where feasible.
- Rich text sanitized on save and on render.
- Supabase: RLS enabled on all tables, service role key server-only, no `NEXT_PUBLIC_` secrets.
- Dependencies: lockfile committed, `pnpm audit` in CI (non-blocking for low severity).
- `docs/SECURITY.md` lists threats considered and mitigations.

### Performance
- Public pages: Server Components, static/ISR with tag-based revalidation; client components only for real interactivity; admin code never in site bundles.
- `next/image` everywhere (correct `sizes`, priority for the LCP image, modern formats, placeholders); `next/font` self-hosted fonts with `display: swap` and subsetting.
- No layout shift from images, fonts or banners.
- DB: indexes for all lookup and analytics queries; pooled connections; no N+1 queries in loaders.
- **Budgets on the demo site (mobile Lighthouse, production build):** Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95, SEO = 100; LCP < 2.5 s, CLS < 0.1, INP < 200 ms. Measure and report in the final summary.

---

## 14. Template ergonomics (for future AI agents)

This template will be cloned into new projects and customized by AI agents. Make that easy and safe:

- **`CLAUDE.md`** at the root, concise, covering: the core/project boundary and what must not be edited; how to add a page (schema → route → seed → `content:sync` → `content:check`); how to add a field type; the design token rule (all visual values only in `src/site/theme`, see §12); commands; testing expectations; security rules that must never be relaxed; definition of done.
- **`docs/CUSTOMIZING.md`**: step-by-step checklist to start a new project: rename, set `project.config.ts`, remove the demo site, build sections from designs, write schemas, seed content from designs, configure locales, theme, deploy.
- **`docs/DEPLOYMENT.md`**: Supabase project setup, Vercel deployment, Netlify deployment, env vars per platform, running migrations in CI/deploy, cron setup, first admin creation in production.
- Semantic versioning with git tags and `CHANGELOG.md`, so projects can pull template updates (document the `git remote add template ...` merge workflow).
- `.env.example` with every variable documented.
- Scripts: `dev`, `build`, `start`, `typecheck`, `lint`, `test`, `e2e`, `db:generate`, `db:migrate`, `db:studio`, `db:seed`, `admin:create`, `content:sync`, `content:check`, `tokens:check`.

---

## 15. Demo site

Small but complete, demonstrating every core feature:
- Pages: **Home**, **About** with sub-page **About → Team**, **Contact**. Together they use every field type (including lists and images).
- Two locales: `en` (default) and `uk`, with seeded content in both.
- Styled entirely through the design token system (§12): every color, font, text style and spacing value comes from `src/site/theme`.
- Simple clean design with a shared header (logo from settings, nav, language switcher) and footer.
- Clearly marked as demo in code comments and `CUSTOMIZING.md` so agents know to replace it.

---

## 16. Implementation phases

1. **Foundation**: scaffold, tooling, lint boundaries, env validation, CI, docs skeleton.
2. **Database**: Drizzle schema, PGlite/postgres drivers, migrations, seed.
3. **Auth & roles**: Better Auth, admin login, permissions, `admin:create`, rate limiting, 2FA, Account page.
4. **Admin shell**: layout, sidebar, theme toggle, local DB banner, status chips.
5. **Content system & design tokens**: schema builders, registry, typed loaders, caching/revalidation, sync/check scripts, design token system + `tokens:check`, demo pages.
6. **Pages editor**: tree, generated forms, images/storage, SEO tab, locales, revisions, concurrency.
7. **Settings & site gate**: all settings, maintenance, private mode, indexing, branding/favicons.
8. **SEO & i18n**: metadata, sitemap, robots, hreflang, JSON-LD, localized 404.
9. **Analytics & Overview**: collection, rollups, dashboard.
10. **Managers & Security pages**: user management, sessions, audit log, env checklist, Connect Supabase wizard + data migration.
11. **Hardening**: security headers/CSP, upload checks, performance pass, Lighthouse, deploy tests on Vercel and Netlify (preview), docs completion, `v1.0.0` tag.

---

## 17. Acceptance criteria (automated tests where possible)

E2E (Playwright) must cover:
- [ ] Fresh clone → `pnpm install && pnpm dev` works with zero config (PGlite, seeded demo, seed admin in dev).
- [ ] Admin login works; wrong password shows a generic error; repeated failures trigger rate limiting.
- [ ] Manager sees only Overview and Pages; direct URL to `/admin/settings` is denied, and calling a settings server action as a manager is rejected server-side.
- [ ] Editing a text and an image on a page in `uk` updates the live `/uk/...` page after save without a rebuild; `en` is unaffected.
- [ ] Concurrent edit conflict is detected.
- [ ] Revisions restore works.
- [ ] Maintenance ON → public page returns **503** with `Retry-After`; `/admin` still works; logged-in staff see the real site.
- [ ] Private mode ON → visitor redirected to `/access`; valid user gets in; a forged cookie does not; pages carry noindex.
- [ ] Indexing OFF → `robots.txt` disallows all and `X-Robots-Tag: noindex` is present; ON → sitemap lists all enabled locales with hreflang alternates.
- [ ] Disabling a locale makes its URLs return 404 and removes it from the sitemap.
- [ ] Last admin cannot be deleted or demoted; a user cannot disable themselves.
- [ ] Local DB banner shows on login and all admin pages with PGlite, and is absent with Supabase.
- [ ] Analytics: visiting demo pages produces page views and unique visitors on Overview; bots are not counted.

Also:
- [ ] `pnpm typecheck`, `lint`, `test`, `build`, `content:check`, `tokens:check` pass in CI.
- [ ] Changing a single token (e.g. the primary color, the body font, or the h1 size/line height/letter spacing) in `src/site/theme` changes it across the whole demo site with no other file edited; a raw value or arbitrary Tailwind value added to a site component makes `tokens:check` fail.
- [ ] No admin or chart code in public route bundles (verify with the build output / bundle analyzer).
- [ ] Lighthouse budgets from §13 met on Home and About (report the numbers).
- [ ] Deploys successfully to both Vercel and Netlify with Supabase.
- [ ] All docs from §3 and §14 are written and accurate.

When finished, give a summary: what was built, decisions taken (link `DECISIONS.md`), Lighthouse results, known limitations, and suggested next steps.
