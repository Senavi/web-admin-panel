# Deployment

Production runs on **Vercel or Netlify** with **Supabase** (Postgres + Storage). PGlite never
runs in production.

## Deploy in 5 minutes

1. **GitHub:** push the project to a repository.
2. **Netlify** (or Vercel): _Add new site → Import an existing project_ and pick the
   repository. Don't add any variables; click **Deploy**.
3. **Preview mode:** the first deploy works without a database. The site shows the demo
   content, is hidden from search engines (`noindex`, robots disallow, empty sitemap),
   forms answer "This form isn't connected yet", and the admin (`projectConfig.adminPath`)
   shows a setup guide.
4. **Add 2 variables** (Site configuration → Environment variables, Production context):
   `DATABASE_URL` (Supabase → Connect → **Session pooler**, the address with
   `pooler.supabase.com:5432`, with your database password) and
   `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API Keys → service_role). The project
   URL and the migration connection are derived from `DATABASE_URL`
   ([connection types](#which-connection-string)).
5. **Redeploy** (Deploys → Trigger deploy). The build runs `pnpm db:migrate:deploy`:
   migrations, then `pnpm db:prepare` (Row Level Security on every table, the `media`
   bucket, default settings and the content from the code; later deploys update texts nobody
   edited when their seed changed, D-095). Then create your admin
   ([§ 5](#5-first-admin-in-production)) and sign in at your admin path.

The site address comes from the platform (`URL` / `DEPLOY_PRIME_URL` on Netlify,
`VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` on Vercel); set `NEXT_PUBLIC_SITE_URL` only
for a domain the platform doesn't know. The sign-in secret is derived from the service role
key unless you set `AUTH_SECRET` (see the table below).

## 1. Supabase project

1. Create a project at https://supabase.com/dashboard. Pick the **same region as your
   hosting's server functions** (Vercel: Project → Settings → Functions → Region; Netlify:
   the functions region in Site configuration → Functions), not the region closest to your
   visitors: every database query travels between the function and the database, while
   pages for visitors are cached and served from the CDN anyway. A far-away database adds
   its round trip to every admin request.
2. Note from the dashboard:
   - the **service_role** key (Project Settings → API Keys; the anon key is optional),
   - the **Session pooler** connection string (Connect) → `DATABASE_URL`.
3. Either:
   - **From development (recommended):** turn on developer mode (avatar menu), open
     **Security → Connect Supabase** and follow the 5 steps. The dialog checks the keys, then
     "Prepare database" runs migrations, copies your local users/settings/content/media,
     enables Row Level Security on every table (no policies: the app connects server-side,
     the Data API exposes nothing), creates the public-read `media` bucket and writes
     `.env.local`. It shows the detected connection type with an **IPv4 ✓ / IPv6 only ⚠**
     badge. The hosting step shows Vercel/Netlify instructions and **Copy all** copies
     `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the optional extras you tick.
   - **Manually:** `DATABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm db:migrate && pnpm
db:prepare` (migrations, RLS on every table, the `media` bucket, settings and demo
     content).

### Which connection string

Supabase shows four (Connect → "Connect to your database"). Netlify and Vercel connect over
**IPv4 only**; any of the four is accepted in `DATABASE_URL`, but only the shared pooler is
reachable from there on the free plan. Testing showed the **Session pooler** is the working
setup on Netlify (the transaction pooler caused errors), so the Connect guide recommends it.

| Type                                 | Host:port                                   | IPv4 (free plan)       | Use                                     |
| ------------------------------------ | ------------------------------------------- | ---------------------- | --------------------------------------- |
| Shared pooler, **session**           | `aws-<n>-<region>.pooler.supabase.com:5432` | yes                    | **recommended** (1 connection/instance) |
| Shared pooler, transaction           | `aws-<n>-<region>.pooler.supabase.com:6543` | yes                    | accepted; caused errors on Netlify      |
| Direct                               | `db.<ref>.supabase.co:5432`                 | no (IPv6; paid add-on) | local tools, IPv4 add-on                |
| Dedicated pooler (paid, transaction) | `db.<ref>.supabase.co:6543`                 | no (IPv6; paid add-on) | with the IPv4 add-on                    |

What the app does with it (D-086): the runtime uses it as is (session mode with one
connection per instance and a short idle timeout); migrations use `DIRECT_URL` if set,
otherwise the same address in session mode (port 5432) for the transaction pooler, otherwise
`DATABASE_URL`; `SUPABASE_URL` is derived from the `postgres.<ref>` user or the `db.<ref>`
host. If an IPv6-only address can't be reached, the build log, the Security status and the
Connect guide say so in plain words and point to the Session pooler address.

## 2. Environment variables

Without `DATABASE_URL` production runs in **preview mode** (above) and needs nothing else.

| Variable                    | Required | Notes                                                                                                                                                      |
| --------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | yes      | any Supabase connection string; use the Session pooler (5432) on Netlify/Vercel                                                                            |
| `SUPABASE_SERVICE_ROLE_KEY` | yes      | server only, never `NEXT_PUBLIC_`                                                                                                                          |
| `SUPABASE_URL`              | optional | derived from `DATABASE_URL`; set it only to override                                                                                                       |
| `DIRECT_URL`                | optional | migration connection; derived from `DATABASE_URL` (session mode, 5432)                                                                                     |
| `NEXT_PUBLIC_SITE_URL`      | optional | defaults to the platform address; set it for your own domain if the platform doesn't know it                                                               |
| `AUTH_SECRET`               | optional | default: derived (HKDF-SHA256) from `SUPABASE_SERVICE_ROLE_KEY`; rotating that key then signs everyone out. Set it (`openssl rand -base64 48`) to decouple |
| `SUPABASE_ANON_KEY`         | optional | connection check only                                                                                                                                      |
| `SUPABASE_STORAGE_BUCKET`   | optional | default `media`                                                                                                                                            |
| `CRON_SECRET`               | optional | enables `/api/cron/maintenance`                                                                                                                            |
| `PREVIEW_DATABASE_ISOLATED` | optional | `true` lets preview deploys migrate                                                                                                                        |

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

For a team (`main` live, `dev` for testing, a branch per task) see [TEAM.md](TEAM.md): `dev`
and pull-request previews normally run in preview mode; an optional staging Supabase project
for `dev` uses the setup below.

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

1. Email: connect a provider in **Settings → Integrations → Email** (Resend, or SMTP with
   presets; admins only, credentials are stored encrypted, "Send test email" checks it), or
   set `MAIL_PROVIDER` and the variables above on the server. `MAIL_PROVIDER=resend|smtp` in
   env wins and shows as "Set on the server" in the admin. Set the other variables for the
   destinations you need (webhook, Telegram) and redeploy.
2. **Settings → Requests**: add **Default recipients** (used by every form without a list of
   its own), optionally a list per form, Webhook (https URL) and/or Telegram (chat id), and
   set how long submissions are kept (default 12 months). The admin warns when email is
   connected but nobody receives requests.
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
