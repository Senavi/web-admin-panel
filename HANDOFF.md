# Handoff: v1.5.1 "one DATABASE_URL" (work in progress)

Branch: `v1.5.1-wip` (based on `main` = v1.5.0, tag `v1.5.0`). Spec: the pasted
"v1.5.1: one DATABASE_URL for any Supabase connection type" (tasks 1–8). Follow CLAUDE.md.

State when handed over: `typecheck`, `lint`, 155 unit tests pass. E2E not run yet.

## Done

1. `src/core/db/connection-info.ts`: `describeConnection()` (shared-transaction /
   shared-session / direct / dedicated / other-postgres, projectRef, ipv4), lenient parser for
   unencoded passwords, `migrationUrl()`, `deriveSupabaseUrl()` / `resolveSupabaseUrl()`,
   `isNetworkError()`, `connectionErrorHint()`, `IPV6_ONLY_MESSAGE`, `maskConnectionString()`.
   Tests: `tests/unit/connection-info.test.ts`.
2. Runtime: `drivers/postgres.ts`: session pooler → `max: 1`, idle 5 s.
3. Migrations/scripts: `scripts/db-migrate.ts`, `scripts/lib/db.ts` use `migrationUrl()`;
   `runScript` prints the IPv6 hint (masked URL) on network errors.
4. `SUPABASE_URL` optional: env schema transform resolves it, `resolveStorageDriver` derives;
   `security/headers.ts` (CSP) and `next.config.ts` (image patterns) use `resolveSupabaseUrl`.
   Tests in `tests/unit/env-schema.test.ts`.
5. Errors: `security/health.ts` adds `hint`, status card shows it; `db/client.ts` warns at
   startup on Netlify/Vercel with an IPv6-only address.
6. Connect guide: `supabase-connect.ts` input = `databaseUrl` + `serviceRoleKey` (+ anon),
   derives `supabaseUrl` and `directUrl` (= migration URL); `.env.local` writes only
   `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (+anon) and removes stale keys.
   `hosting-guides.ts`: KEY_FIELDS (connection string → Shared pooler → Transaction pooler),
   REQUIRED = DATABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Wizard: one field + `ConnectionTypeBadge`
   (IPv4 ✓ / IPv6 only ⚠). Setup page (`/admin/setup`) asks for two values.
7. Docs: `.env.example`, `docs/DEPLOYMENT.md` (four types table, 2 variables),
   env catalog, DECISIONS D-086, CHANGELOG `[1.5.1]`, `package.json` 1.5.1.

## To finish

1. E2E (only these, not the whole suite):
   - `tests/e2e-preview/preview-mode.spec.ts`: on the setup page assert
     `getByLabel('Values to copy').locator('code')` = `['DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']`
     and that it mentions `pooler.supabase.com:6543`. Run `pnpm e2e:preview`.
   - New `tests/e2e/connect-supabase.spec.ts` (dev only: `test.skip(Boolean(process.env.E2E_BASE_URL))`,
     import `test/expect` from `./support/test`, URLs via `admin()`): login as `E2E_ADMIN`,
     `setDeveloperMode(true)`, open Security → Connect Supabase → "I have created the project";
     one "Connection string" field, no "Project URL"/"Direct connection string"; fill
     `postgresql://postgres:pw@db.<ref>.supabase.co:5432/postgres` → status "Connection type"
     shows "Direct connection" + "IPv6 only"; fill a `…pooler.supabase.com:6543` string →
     "Shared pooler, transaction mode" + "IPv4 ✓"; turn developer mode off. Run with
     `pnpm e2e tests/e2e/connect-supabase.spec.ts` (dev server).
   - Optionally `pnpm e2e:prod tests/e2e/managers.spec.ts tests/e2e/admin-simple.spec.ts`
     (Security status card).
2. `pnpm format && pnpm typecheck && pnpm lint && pnpm test && pnpm content:check && pnpm tokens:check`.
3. Delete this file, merge `v1.5.1-wip` into `main`, tag `v1.5.1`, push (ask the user first).

Notes: the admin is at `/stst-admin` (custom `adminPath`); pnpm is at `~/.local/bin`
(`export PATH=$HOME/.local/bin:$PATH`).
