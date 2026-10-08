# Site Starter

A reusable Next.js website starter with a production-grade, schema-driven admin panel.
Clone it for a new project, replace the demo site, write content schemas, and you get a
working admin (content, SEO, settings, users, analytics, security) for free.

- **Stack:** Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind 4,
  shadcn/ui, Drizzle ORM, Better Auth, next-intl, Zod.
- **Database:** embedded PGlite in development (zero config) → Supabase Postgres in production.
- **Hosting:** Vercel or Netlify.

## Quick start

```bash
corepack enable pnpm
pnpm install
pnpm dev
```

Open http://localhost:3000 (site) and http://localhost:3000/admin (admin). The development
admin's credentials are written to `.data/dev-admin-credentials.txt` on the first run.

## Features

- Schema-driven page editor (10 field types, rich text, images with per-locale alt text,
  lists, SEO tab, revisions, conflict detection) generated from `src/content`.
- Roles (admin, manager), TOTP 2FA, login throttling, audit log, session management.
- Settings: languages, SEO defaults, branding (logos, favicons), maintenance mode (503),
  private mode, indexing, analytics, security policy.
- SEO: metadata, hreflang, sitemap, robots, JSON-LD, generated OG images, localized 404.
- Cookieless analytics with an Overview dashboard.
- Design tokens as the single source of the site's look (`pnpm tokens:check`).
- Local PGlite → Supabase with a guided Connect Supabase wizard.

## Quality gates

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm content:check && pnpm tokens:check
pnpm e2e          # Playwright against the dev server
pnpm e2e:prod     # Playwright against a production build
```

## Documentation

| Doc                                              | Purpose                                   |
| ------------------------------------------------ | ----------------------------------------- |
| [docs/SPEC.md](docs/SPEC.md)                     | Full product specification                |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)     | Layers, boundaries, data flow             |
| [docs/CONTENT_SCHEMA.md](docs/CONTENT_SCHEMA.md) | Defining pages, sections and fields       |
| [docs/CUSTOMIZING.md](docs/CUSTOMIZING.md)       | Starting a new project from this template |
| [docs/DESIGN_TOKENS.md](docs/DESIGN_TOKENS.md)   | The site's design token system            |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)         | Supabase, Vercel and Netlify setup        |
| [docs/SECURITY.md](docs/SECURITY.md)             | Threat model and mitigations              |
| [docs/DECISIONS.md](docs/DECISIONS.md)           | Architecture decision log                 |
| [CLAUDE.md](CLAUDE.md)                           | Rules for AI agents working in this repo  |
