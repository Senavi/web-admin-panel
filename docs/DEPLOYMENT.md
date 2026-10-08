# Deployment

Production runs on **Vercel or Netlify** with **Supabase** (Postgres + Storage). PGlite never
runs in production.

## 1. Supabase project

1. Create a project at https://supabase.com/dashboard.
2. Note from the dashboard:
   - **Project URL** and **anon** / **service_role** keys (Project Settings → API Keys),
   - **Transaction pooler** connection string (Connect, port 6543) → `DATABASE_URL`,
   - **Direct** (or session pooler, port 5432) connection string → `DIRECT_URL`.
3. Either:
   - **From development (recommended):** open the admin → **Security → Connect Supabase**.
     The wizard tests the connection, runs migrations, copies your local users/settings/
     content/media, enables Row Level Security on every table (no policies: the app connects
     server-side, the Data API exposes nothing), creates the public-read `media` bucket and
     writes `.env.local`.
   - **Manually:** `DIRECT_URL=… pnpm db:migrate`, then `DATABASE_URL=… pnpm db:seed`
     (settings + demo content), create a public bucket `media`, and enable RLS on all tables:
     `alter table "<table>" enable row level security;`

## 2. Environment variables

| Variable                    | Required    | Notes                                   |
| --------------------------- | ----------- | --------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`      | yes         | e.g. `https://www.example.com`          |
| `DATABASE_URL`              | yes         | Supabase transaction pooler (6543)      |
| `DIRECT_URL`                | recommended | Direct connection (5432) for migrations |
| `AUTH_SECRET`               | yes         | `openssl rand -base64 48`               |
| `SUPABASE_URL`              | yes         | storage                                 |
| `SUPABASE_SERVICE_ROLE_KEY` | yes         | server only, never `NEXT_PUBLIC_`       |
| `SUPABASE_ANON_KEY`         | optional    | connection check only                   |
| `SUPABASE_STORAGE_BUCKET`   | optional    | default `media`                         |
| `CRON_SECRET`               | optional    | enables `/api/cron/maintenance`         |

The admin's **Security** page shows which variables are set (values masked).

## 3. Vercel

1. Import the repository. Framework: Next.js. Install: `pnpm install`.
2. Add the variables (Project → Settings → Environment Variables) for Production and Preview.
3. `vercel.json` sets the build command to `pnpm db:migrate && pnpm build`, so migrations
   run on every deploy (using `DIRECT_URL`), and schedules the daily maintenance cron
   (Vercel sends `Authorization: Bearer $CRON_SECRET`).

## 4. Netlify

1. Import the repository. `netlify.toml` sets the build command
   (`pnpm db:migrate && pnpm build`) and the functions directory.
2. Add the variables (Site configuration → Environment variables).
3. `netlify/functions/maintenance.mts` is a Scheduled Function that calls
   `/api/cron/maintenance` daily with `CRON_SECRET`.

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
- Settings → Site status: indexing on, maintenance/private off; Settings → SEO defaults.

## Local production build

```bash
pnpm db:serve            # serves .data/pglite as Postgres, prints DATABASE_URL
DATABASE_URL=… AUTH_SECRET=… NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
  STORAGE_DRIVER=local ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true pnpm build && pnpm start
```
