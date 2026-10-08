import path from 'node:path';

/** Local data root (gitignored). Holds the PGlite database, uploads and dev secrets. */
export const DATA_DIR = path.join(process.cwd(), '.data');
export const PGLITE_DIR = path.join(DATA_DIR, 'pglite');
export const PGLITE_LOCK_FILE = path.join(DATA_DIR, 'pglite.lock');
export const MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'core', 'db', 'migrations');
