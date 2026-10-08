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
