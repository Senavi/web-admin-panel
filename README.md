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

Open http://localhost:3000 (site) and http://localhost:3000/admin (admin).

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
