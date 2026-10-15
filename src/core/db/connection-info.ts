/**
 * What kind of Postgres a connection string points to, and what follows from
 * it (docs/DECISIONS.md D-086). Pure (no `server-only`): used by the env schema,
 * next.config, scripts and the Connect Supabase dialog in the browser.
 *
 * Supabase offers four strings ("Connect to your database"):
 * | kind               | host:port                                  | IPv4 (free plan) |
 * | shared-transaction | aws-<n>-<region>.pooler.supabase.com:6543  | yes              |
 * | shared-session     | aws-<n>-<region>.pooler.supabase.com:5432  | yes              |
 * | direct             | db.<ref>.supabase.co:5432                  | no (IPv6)        |
 * | dedicated          | db.<ref>.supabase.co:6543                  | no (IPv6)        |
 * Netlify and Vercel connect over IPv4 only. The shared SESSION pooler is the
 * recommended setup there (the transaction pooler caused errors on Netlify).
 */

export const ConnectionKind = {
  SharedTransaction: 'shared-transaction',
  SharedSession: 'shared-session',
  Direct: 'direct',
  Dedicated: 'dedicated',
  OtherPostgres: 'other-postgres',
} as const;
export type ConnectionKind = (typeof ConnectionKind)[keyof typeof ConnectionKind];

export interface ConnectionInfo {
  readonly kind: ConnectionKind;
  /** Supabase project ref (from the pooler user `postgres.<ref>` or the host `db.<ref>…`). */
  readonly projectRef?: string;
  /** Reachable from IPv4-only hosts (Netlify, Vercel). Unknown hosts count as reachable. */
  readonly ipv4: boolean;
}

const POSTGRES_DEFAULT_PORT = 5432;
const TRANSACTION_POOLER_PORT = 6543;
const SESSION_PORT = 5432;
const SHARED_POOLER_HOST = /\.pooler\.supabase\.com$/i;
const SUPABASE_DB_HOST = /^db\.([a-z0-9]+)\.supabase\.co$/i;
const POOLER_USER = /^[^.]+\.([a-z0-9]+)$/i;

/** Plain-language fix for IPv6-only addresses (build log, Security status, Connect guide). */
export const IPV6_ONLY_MESSAGE =
  'This Supabase address works only over IPv6 (or with the paid IPv4 add-on). Netlify and Vercel need IPv4: in Supabase → Connect → Session pooler, copy the address with `pooler.supabase.com:5432`.';

interface ParsedUrl {
  readonly user: string;
  readonly host: string;
  readonly port: number;
  /** The same URL with another port. */
  readonly withPort: (port: number) => string;
  /** The same URL with the password replaced. */
  readonly masked: string;
}

/**
 * Lenient parser: the WHATWG URL parser rejects passwords with an unencoded `@`,
 * `#` or `/`, which people often paste. The authority is split at the LAST `@`.
 */
const LOOSE_URL = /^(postgres(?:ql)?:\/\/)([^:@/]*)(?::(.*))?@([^@/?#:]+)(?::(\d+))?(.*)$/is;

function parse(url: string): ParsedUrl | null {
  const match = LOOSE_URL.exec(url.trim());
  if (!match) return null;
  const [, scheme = '', user = '', password, host = '', port, rest = ''] = match;
  const build = (portValue: string | undefined, secret: string | undefined) =>
    `${scheme}${user}${secret === undefined ? '' : `:${secret}`}@${host}${portValue ? `:${portValue}` : ''}${rest}`;
  let decodedUser = user;
  try {
    decodedUser = decodeURIComponent(user);
  } catch {
    // Keep the raw user name.
  }
  return {
    user: decodedUser,
    host: host.toLowerCase(),
    port: Number(port || POSTGRES_DEFAULT_PORT),
    withPort: (next) => build(String(next), password),
    masked: build(port, password === undefined ? undefined : '****'),
  };
}

/** Detects the connection type; null for anything that isn't a postgres:// URL. */
export function describeConnection(url: string | undefined | null): ConnectionInfo | null {
  const parsed = url ? parse(url) : null;
  if (!parsed) return null;
  const { host, port } = parsed;

  if (SHARED_POOLER_HOST.test(host)) {
    const ref = POOLER_USER.exec(parsed.user)?.[1]?.toLowerCase();
    return {
      kind:
        port === TRANSACTION_POOLER_PORT
          ? ConnectionKind.SharedTransaction
          : ConnectionKind.SharedSession,
      ...(ref ? { projectRef: ref } : {}),
      ipv4: true,
    };
  }
  const direct = SUPABASE_DB_HOST.exec(host);
  if (direct?.[1]) {
    return {
      kind: port === TRANSACTION_POOLER_PORT ? ConnectionKind.Dedicated : ConnectionKind.Direct,
      projectRef: direct[1].toLowerCase(),
      ipv4: false,
    };
  }
  return { kind: ConnectionKind.OtherPostgres, ipv4: true };
}

/**
 * URL for migrations and admin scripts: `DIRECT_URL` if set; for the shared
 * transaction pooler the same address in session mode (port 5432, same host
 * and user: DDL and advisory locks need a session); otherwise `DATABASE_URL`.
 */
export function migrationUrl(source: {
  readonly DATABASE_URL?: string;
  readonly DIRECT_URL?: string;
}): string | undefined {
  const direct = source.DIRECT_URL?.trim();
  if (direct) return direct;
  const database = source.DATABASE_URL?.trim();
  if (!database) return undefined;
  if (describeConnection(database)?.kind !== ConnectionKind.SharedTransaction) return database;
  return parse(database)?.withPort(SESSION_PORT) ?? database;
}

/** `https://<ref>.supabase.co` from a Supabase connection string, or null. */
export function deriveSupabaseUrl(databaseUrl: string | undefined | null): string | null {
  const ref = describeConnection(databaseUrl)?.projectRef;
  return ref ? `https://${ref}.supabase.co` : null;
}

/** `SUPABASE_URL` if set, otherwise derived from `DATABASE_URL`. */
export function resolveSupabaseUrl(source: {
  readonly SUPABASE_URL?: string;
  readonly DATABASE_URL?: string;
}): string | undefined {
  return source.SUPABASE_URL?.trim() || deriveSupabaseUrl(source.DATABASE_URL) || undefined;
}

const NETWORK_ERROR_CODES = new Set([
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'CONNECT_TIMEOUT',
]);

/** True for errors that mean "couldn't reach the server" (not auth or SQL errors). */
export function isNetworkError(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && depth < 4; depth += 1) {
    if (typeof current !== 'object') break;
    const { code, errno, message } = current as {
      code?: unknown;
      errno?: unknown;
      message?: unknown;
    };
    if (typeof code === 'string' && NETWORK_ERROR_CODES.has(code)) return true;
    if (typeof errno === 'string' && NETWORK_ERROR_CODES.has(errno)) return true;
    if (
      typeof message === 'string' &&
      /connect_timeout|ENETUNREACH|EHOSTUNREACH|ENOTFOUND|ETIMEDOUT/i.test(message)
    )
      return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** The IPv6 hint when a network error hit an IPv6-only Supabase address, else null. */
export function connectionErrorHint(error: unknown, url: string | undefined | null): string | null {
  const info = describeConnection(url);
  return info && !info.ipv4 && isNetworkError(error) ? IPV6_ONLY_MESSAGE : null;
}

/** A connection string with the password replaced, for logs and messages. */
export function maskConnectionString(url: string): string {
  return parse(url)?.masked ?? '(not a postgres:// URL)';
}
