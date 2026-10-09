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
/** Written by `pnpm dev` while it serves PGlite to Next.js workers and CLI scripts. */
export const PGLITE_SERVER_FILE = path.join(DATA_DIR, 'pglite-server.json');
export const MIGRATIONS_DIR = path.join(/*turbopackIgnore: true*/ ROOT, 'src/core/db/migrations');

/** Project convention: seed images referenced by page seeds (`{ asset: 'hero.webp' }`). */
export const SEED_ASSETS_DIR = path.join(/*turbopackIgnore: true*/ ROOT, 'src/content/seed/assets');

/** Emails written by the `dev` mail provider (form submissions in development and tests). */
export const MAIL_DIR = path.join(DATA_DIR, 'mail');
