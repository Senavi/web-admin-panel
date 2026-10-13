# Deployment

Production runs on **Vercel or Netlify** with **Supabase** (Postgres + Storage). PGlite never
runs in production.

## Deploy in 5 minutes

1. **GitHub:** push the project to a repository.
2. **Netlify** (or Vercel): _Add new site → Import an existing project_ and pick the
   repository. Don't add any variables; click **Deploy**.
3. **Preview mode:** the first deploy works without a database. The site shows the demo
   content, is hidden from search engines (`noindex`, robots disallow, empty sitemap),
   forms answer "This form isn't connected yet", and `/admin` shows a setup guide.
4. **Add 3 variables** (Site configuration → Environment variables, Production context):
   `DATABASE_URL` (Supabase → Connect → Transaction pooler, port 6543, with your database
   password), `SUPABASE_URL` (Project Settings → Data API) and `SUPABASE_SERVICE_ROLE_KEY`
   (Project Settings → API Keys → service_role). `DIRECT_URL` (port 5432) is recommended.
5. **Redeploy** (Deploys → Trigger deploy). The build runs `pnpm db:migrate:deploy`:
   migrations, then `pnpm db:prepare` (Row Level Security on every table, the `media`
   bucket, default settings and the demo content). Then create your admin
   ([§ 5](#5-first-admin-in-production)) and sign in at `/admin`.

The site address comes from the platform (`URL` / `DEPLOY_PRIME_URL` on Netlify,
`VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` on Vercel); set `NEXT_PUBLIC_SITE_URL` only
for a domain the platform doesn't know. The sign-in secret is derived from the service role
key unless you set `AUTH_SECRET` (see the table below).

## 1. Supabase project

1. Create a project at https://supabase.com/dashboard.
2. Note from the dashboard:
   - **Project URL** and the **service_role** key (Project Settings → API Keys; the anon key
     is optional),
   - **Transaction pooler** connection string (Connect, port 6543) → `DATABASE_URL`,
   - **Direct** (or session pooler, port 5432) connection string → `DIRECT_URL`.
3. Either:
   - **From development (recommended):** turn on developer mode (avatar menu), open
     **Security → Connect Supabase** and follow the 5 steps. The dialog checks the keys, then
     "Prepare database" runs migrations, copies your local users/settings/content/media,
     enables Row Level Security on every table (no policies: the app connects server-side,
     the Data API exposes nothing), creates the public-read `media` bucket and writes
     `.env.local`. The hosting step shows Vercel/Netlify instructions and **Copy all**
     copies the 7 production variables as `.env` text with freshly generated
     `AUTH_SECRET` and `CRON_SECRET`.
   - **Manually:** `DIRECT_URL=… pnpm db:migrate`, then `DATABASE_URL=… pnpm db:seed`
     (settings + demo content), create a public bucket `media`, and enable RLS on all tables:
     `alter table "<table>" enable row level security;`

## 2. Environment variables

Without `DATABASE_URL` production runs in **preview mode** (above) and needs nothing else.

| Variable                    | Required    | Notes                                                                                                                                                      |
| --------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | yes         | Supabase transaction pooler (6543)                                                                                                                         |
| `SUPABASE_URL`              | yes         | storage                                                                                                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | yes         | server only, never `NEXT_PUBLIC_`                                                                                                                          |
| `DIRECT_URL`                | recommended | Direct connection (5432) for migrations                                                                                                                    |
| `NEXT_PUBLIC_SITE_URL`      | optional    | defaults to the platform address; set it for your own domain if the platform doesn't know it                                                               |
| `AUTH_SECRET`               | optional    | default: derived (HKDF-SHA256) from `SUPABASE_SERVICE_ROLE_KEY`; rotating that key then signs everyone out. Set it (`openssl rand -base64 48`) to decouple |
| `SUPABASE_ANON_KEY`         | optional    | connection check only                                                                                                                                      |
| `SUPABASE_STORAGE_BUCKET`   | optional    | default `media`                                                                                                                                            |
| `CRON_SECRET`               | optional    | enables `/api/cron/maintenance`                                                                                                                            |
| `PREVIEW_DATABASE_ISOLATED` | optional    | `true` lets preview deploys migrate                                                                                                                        |

Forms (only what you use; destinations are configured in **Settings → Requests**):

| Variable                                               | Notes                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `MAIL_PROVIDER`                                        | `resend` or `smtp` in production (`dev` writes files to `<data>/mail/`) |
| `MAIL_FROM`                                            | sender, e.g. `Website <forms@example.com>` (verified in your provider)  |
| `RESEND_API_KEY`                                       | with `MAIL_PROVIDER=resend`                                             |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | with `MAIL_PROVIDER=smtp` (465 = TLS, otherwise STARTTLS)               |
| `FORMS_WEBHOOK_SECRET`                                 | signs webhooks: `X-Signature: sha256=<hex HMAC-SHA256 of the raw body>` |
| `TELEGRAM_BOT_TOKEN`                                   | bot that posts to the chat id set in Settings → Requests                |
| `TURNSTILE_SECRET_KEY`                                 | with `projectConfig.forms.turnstile.siteKey` (optional spam challenge)  |

In developer mode the admin's **Security** page shows where the sign-in secret comes from.

## 3. Vercel

1. Import the repository. Framework: Next.js. Install: `pnpm install`.
2. Add the variables (Project → Settings → Environment Variables). Scope the production
   database variables to **Production** only (see [Preview deploys](#preview-deploys)).
3. `vercel.json` sets the build command to `pnpm db:migrate:deploy && pnpm build`, so
   migrations run on production deploys (using `DIRECT_URL`), and schedules the daily
   maintenance cron (Vercel sends `Authorization: Bearer $CRON_SECRET`).

## 4. Netlify

1. Import the repository. `netlify.toml` sets the build command
   (`pnpm db:migrate:deploy && pnpm build`) and the functions directory.
2. Add the variables (Site configuration → Environment variables), with the production
   database scoped to the **Production** deploy context.
3. `netlify/functions/maintenance.mts` is a Scheduled Function that calls
   `/api/cron/maintenance` daily with `CRON_SECRET`.

## Preview deploys

`pnpm db:migrate:deploy` decides whether to migrate from the platform context:

| Context                                                      | Migrates?                                |
| ------------------------------------------------------------ | ---------------------------------------- |
| Not on Vercel/Netlify (local, CI, other hosts)               | yes                                      |
| Vercel `VERCEL_ENV=production`, Netlify `CONTEXT=production` | yes                                      |
| Any preview / branch deploy                                  | only if `PREVIEW_DATABASE_ISOLATED=true` |

A preview branch must never change the production schema: a migration from an unmerged
branch would break the live site. Two safe setups:

- **No database for previews** (simplest): give the database variables only to the
  Production scope. Previews skip migrations and need their own `DATABASE_URL` to render.
- **Separate preview database:** create a second Supabase project (or a Supabase branch),
  set its `DATABASE_URL`/`DIRECT_URL` for the Preview scope only, and set
  `PREVIEW_DATABASE_ISOLATED=true` there. Previews then migrate their own database.

The build log always prints the decision and its reason.

## Forms

1. Set the env variables above for the destinations you need and redeploy.
2. **Settings → Requests**: per form enable Email (recipients), Webhook (https URL) and/or
   Telegram (chat id), and set how long submissions are kept (default 12 months).
3. Verify webhooks on the receiving side: compute `HMAC-SHA256(FORMS_WEBHOOK_SECRET, body)`
   over the raw request body and compare it (constant time) with `X-Signature` after
   `sha256=`. The `X-Submission-Id` header identifies retries.
4. Failed deliveries show in the inbox and are retried by the maintenance job (cron, or
   lazily when staff open the Overview); configure the cron so retries happen promptly.

## 5. First admin in production

There is no public sign-up and no default account. From your machine:

```bash
DATABASE_URL="<direct or pooled url>" pnpm admin:create
```

(or move your development users with Connect Supabase).

## 6. Cron (optional)

Analytics rollups and retention cleanup also run lazily (at most hourly), so a scheduler
is optional. With `CRON_SECRET` set:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://www.example.com/api/cron/maintenance
```

## 7. Checks before going live

- `pnpm typecheck && pnpm lint && pnpm test && pnpm content:check && pnpm tokens:check`
- `pnpm e2e:prod`: the full e2e suite against a production build
- `pnpm check:bundles` after `pnpm build`
- Settings → Site access: not paused, not private; Settings → Google & sharing: "Show the site in Google" on.

## Local production build

```bash
pnpm db:serve            # serves .data/pglite as Postgres, prints DATABASE_URL
DATABASE_URL=… AUTH_SECRET=… NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
  STORAGE_DRIVER=local ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true pnpm build && pnpm start
```
