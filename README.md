# Site Starter

A reusable Next.js website starter with a production-grade, schema-driven admin panel.
Clone it for a new project, replace the demo site, write content schemas, and you get a
working admin (content, SEO, settings, users, analytics, security) for free.

- **Stack:** Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind 4,
  shadcn/ui, Drizzle ORM, Better Auth, next-intl, Zod.
- **Database:** embedded PGlite in development (zero config) → Neon (recommended) or
  Supabase Postgres online, with production, staging and preview environments.
- **Hosting:** Vercel or Netlify.

## Quick start

```bash
corepack enable pnpm
pnpm install
pnpm dev
```

Open http://localhost:3000 (site) and http://localhost:3000/stst-admin (admin; the path is
`adminPath` in `project.config.ts`). The development
admin's credentials are written to `.data/dev-admin-credentials.txt` on the first run.

To start your local database over from the code (deletes local content, users, images and
emails, then prints a new admin password), stop `pnpm dev` and run:

```bash
pnpm db:reset
```

Working with other people? Read [docs/TEAM.md](docs/TEAM.md) (`main` / `staging` / pull
requests, local databases, seeds, online databases, refreshing staging).

If `pnpm dev` keeps reloading the page right after `pnpm build` (which shares `.next`), stop
it, delete `.next/dev` and start it again. `pnpm preview` and `pnpm e2e:prod` use their own
folders and don't affect it.

## Deploy

Import the repository into Netlify or Vercel and deploy: it works with **zero variables**
(preview mode: demo content, hidden from search engines, the admin shows a setup guide).
Then connect a database (Neon: `DATABASE_URL`, `AUTH_SECRET` and the `S3_*` storage values;
Supabase: `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`) and redeploy. See
docs/DEPLOYMENT.md § Deploy in 5 minutes. Three environments: `main` → production,
`staging` → staging with its own database, pull requests → previews (docs/TEAM.md).

## Test the speed

`pnpm dev` compiles each page on its first visit and has no prefetching, so it feels slower
than the real site (it pre-compiles the main pages in the background after start). To judge
speed, run the production build locally:

```bash
pnpm preview
```

It builds into `.next-preview` (separate from `pnpm dev`) and serves the local database at
http://localhost:3300 (admin at `projectConfig.adminPath`, same dev admin). `pnpm measure:nav`
prints click → feedback / content times for the main site and admin pages.

## Features

- Plain-language admin for clients: collapsed sections with summaries, Settings in tabs
  (General, Brand, Google & sharing, Requests, Site access) and a per-user **developer
  mode** that reveals the technical settings.
- Schema-driven page editor (10 field types, rich text, images with per-locale
  descriptions, lists, Google & sharing tab with a preview, revisions, conflict detection)
  generated from `src/content`.
- Roles (admin, manager), TOTP 2FA, login throttling, activity log, signed-in devices.
- Settings: languages, Google defaults, brand (logos, browser tab icon), pause the site
  (503), private site, show in Google, analytics, security policy.
- SEO: metadata, hreflang, sitemap, robots, JSON-LD, generated OG images, localized 404.
- Cookieless analytics with an Overview dashboard.
- Design tokens as the single source of the site's look (`pnpm tokens:check`).
- Local PGlite → Neon or Supabase with guided Connect wizards; production, staging (never
  indexed, no tracking, emails to the team) and preview environments.

## Quality gates

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm content:check && pnpm tokens:check
pnpm e2e          # Playwright against the dev server
pnpm e2e:prod     # Playwright against a production build
```

## Windows

- **Line endings.** The repo is LF-only (`.gitattributes`, Prettier `endOfLine: "lf"`). If a
  clone made before v1.8.3 still shows hundreds of files in `pnpm format:check`, run once:

  ```bash
  git add --renormalize .
  ```

- **`ERR_SWC_NATIVE_CACHE`.** On some Windows machines `next typegen`, `pnpm typecheck` or
  `pnpm dev` fail with this error. Point the SWC native binding cache to a folder in your
  user profile (reported fix; not reproducible on macOS/Linux):

  ```powershell
  setx SWC_NATIVE_BINDING_CACHE "$env:USERPROFILE\.cache\swc"
  ```

  ```bash
  echo 'export SWC_NATIVE_BINDING_CACHE="$USERPROFILE/.cache/swc"' >> ~/.bashrc
  ```

  Open a new terminal afterwards (Git Bash: or `source ~/.bashrc`).

## Documentation

| Doc                                              | Purpose                                   |
| ------------------------------------------------ | ----------------------------------------- |
| [docs/SPEC.md](docs/SPEC.md)                     | Full product specification                |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)     | Layers, boundaries, data flow             |
| [docs/CONTENT_SCHEMA.md](docs/CONTENT_SCHEMA.md) | Defining pages, sections and fields       |
| [docs/CUSTOMIZING.md](docs/CUSTOMIZING.md)       | Starting a new project from this template |
| [docs/DESIGN_TOKENS.md](docs/DESIGN_TOKENS.md)   | The site's design token system            |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)         | Supabase, Vercel and Netlify setup        |
| [docs/TEAM.md](docs/TEAM.md)                     | Working as a team: branches and databases |
| [docs/SECURITY.md](docs/SECURITY.md)             | Threat model and mitigations              |
| [docs/DECISIONS.md](docs/DECISIONS.md)           | Architecture decision log                 |
| [CLAUDE.md](CLAUDE.md)                           | Rules for AI agents working in this repo  |
