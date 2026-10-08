import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit generates SQL migrations from `src/core/db/schema`. The same
 * migrations run on local PGlite and on Supabase Postgres.
 * `db:studio` / `db:migrate` against Postgres use DIRECT_URL (non-pooled).
 */
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/core/db/schema/index.ts',
  out: './src/core/db/migrations',
  strict: true,
  verbose: true,
  ...(url
    ? { dbCredentials: { url } }
    : { driver: 'pglite', dbCredentials: { url: '.data/pglite' } }),
});
