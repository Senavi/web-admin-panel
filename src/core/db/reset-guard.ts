/**
 * Safety checks of `pnpm db:reset` (pure; unit-tested). The reset deletes the
 * local PGlite data, so it refuses anything that could be someone's real
 * database: production, or any DATABASE_URL / DIRECT_URL (a remote database is
 * never reset; a local Postgres isn't what this command resets either).
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** True for a connection string whose host is this machine. */
export function isLocalDatabaseUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export interface ResetEnvironment {
  readonly NODE_ENV?: string;
  readonly DATABASE_URL?: string;
  readonly DIRECT_URL?: string;
}

/** Why `db:reset` must not run here, or null when it may. */
export function resetRefusal(environment: ResetEnvironment): string | null {
  if (environment.NODE_ENV === 'production') {
    return 'Refusing to reset: NODE_ENV=production. `pnpm db:reset` is for local development only.';
  }
  const url = environment.DATABASE_URL || environment.DIRECT_URL;
  if (!url) return null;
  if (!isLocalDatabaseUrl(url)) {
    return (
      'Refusing to reset: DATABASE_URL points to a remote database. `pnpm db:reset` only resets ' +
      'the local database (.data/pglite) and never touches an online one. Remove DATABASE_URL ' +
      '(and DIRECT_URL) from .env to reset your local database.'
    );
  }
  return (
    'Refusing to reset: DATABASE_URL is set, so the app uses that Postgres database, not ' +
    '.data/pglite. Remove DATABASE_URL from .env to reset the local database, or recreate the ' +
    'Postgres database yourself.'
  );
}
