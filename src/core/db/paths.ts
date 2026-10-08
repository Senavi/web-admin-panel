import path from 'node:path';

/*
 * These paths are only used at runtime in development (PGlite, local uploads,
 * dev secrets) and by CLI scripts. `turbopackIgnore` stops the bundler from
 * tracing the whole project into serverless output because of `process.cwd()`.
 */
const ROOT = /*turbopackIgnore: true*/ process.cwd();

/**
 * Local data root (gitignored). Holds the PGlite database, uploads and dev secrets.
 * `SITE_DATA_DIR` overrides it (used by e2e tests for an isolated database).
 */
export const DATA_DIR = path.resolve(
  /*turbopackIgnore: true*/ ROOT,
  process.env.SITE_DATA_DIR || '.data',
);
export const PGLITE_DIR = path.join(DATA_DIR, 'pglite');
export const PGLITE_LOCK_FILE = path.join(DATA_DIR, 'pglite.lock');
export const MIGRATIONS_DIR = path.join(/*turbopackIgnore: true*/ ROOT, 'src/core/db/migrations');
