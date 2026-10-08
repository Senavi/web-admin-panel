# Changelog

All notable changes to this template are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
