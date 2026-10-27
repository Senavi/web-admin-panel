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
 *
 * Neon (D-096) offers a pooled host (`ep-<name>-pooler.<region>.aws.neon.tech`,
 * PgBouncer in transaction mode: no SQL PREPARE, session settings or session
 * advisory locks) and the direct host (the same without `-pooler`). The runtime
 * uses the pooled one; migrations, `db:prepare` and the deploy lock use the
 * direct one, derived when `DIRECT_URL` isn't set. Neon requires TLS.
 */

/** Who hosts the database (shown in Security → Database). */
export const DatabaseProvider = {
  Supabase: 'supabase',
  Neon: 'neon',
  Postgres: 'postgres',
} as const;
export type DatabaseProvider = (typeof DatabaseProvider)[keyof typeof DatabaseProvider];

export const DATABASE_PROVIDER_LABELS: Record<DatabaseProvider, string> = {
  [DatabaseProvider.Supabase]: 'Supabase',
  [DatabaseProvider.Neon]: 'Neon',
  [DatabaseProvider.Postgres]: 'Postgres',
};

export const ConnectionKind = {
  SharedTransaction: 'shared-transaction',
  SharedSession: 'shared-session',
  Direct: 'direct',
  Dedicated: 'dedicated',
  NeonPooled: 'neon-pooled',
  NeonDirect: 'neon-direct',
  OtherPostgres: 'other-postgres',
} as const;
export type ConnectionKind = (typeof ConnectionKind)[keyof typeof ConnectionKind];

export interface ConnectionInfo {
  readonly kind: ConnectionKind;
  readonly provider: DatabaseProvider;
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
/** `ep-cool-darkness-123456[-pooler].<region>.aws.neon.tech` (also Azure regions). */
const NEON_HOST = /^(ep-[a-z0-9-]+?)(-pooler)?\.([a-z0-9.-]+\.)?neon\.tech$/i;
const NEON_POOLER_SUFFIX = '-pooler';

/** Plain-language fix for IPv6-only addresses (build log, Security status, Connect guide). */
export const IPV6_ONLY_MESSAGE =
  'This Supabase address works only over IPv6 (or with the paid IPv4 add-on). Netlify and Vercel need IPv4: in Supabase → Connect → Session pooler, copy the address with `pooler.supabase.com:5432`.';

interface ParsedUrl {
  readonly user: string;
  readonly host: string;
  readonly port: number;
  /** The same URL with another port. */
  readonly withPort: (port: number) => string;
  /** The same URL with another host. */
  readonly withHost: (host: string) => string;
  /** Query string after `?` ('' when there is none). */
  readonly query: string;
  /** Path after the host, e.g. `/postgres?sslmode=require`. */
  readonly path: string;
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
  const build = (
    portValue: string | undefined,
    secret: string | undefined,
    hostValue: string = host,
  ) =>
    `${scheme}${user}${secret === undefined ? '' : `:${secret}`}@${hostValue}${portValue ? `:${portValue}` : ''}${rest}`;
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
    withHost: (next) => build(port, password, next),
    query: rest.includes('?') ? rest.slice(rest.indexOf('?') + 1) : '',
    path: rest,
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
      provider: DatabaseProvider.Supabase,
      ...(ref ? { projectRef: ref } : {}),
      ipv4: true,
    };
  }
  const direct = SUPABASE_DB_HOST.exec(host);
  if (direct?.[1]) {
    return {
      kind: port === TRANSACTION_POOLER_PORT ? ConnectionKind.Dedicated : ConnectionKind.Direct,
      provider: DatabaseProvider.Supabase,
      projectRef: direct[1].toLowerCase(),
      ipv4: false,
    };
  }
  const neon = NEON_HOST.exec(host);
  if (neon) {
    return {
      kind: neon[2] ? ConnectionKind.NeonPooled : ConnectionKind.NeonDirect,
      provider: DatabaseProvider.Neon,
      ipv4: true,
    };
  }
  return { kind: ConnectionKind.OtherPostgres, provider: DatabaseProvider.Postgres, ipv4: true };
}

/** Database provider of a connection string (null when it isn't a postgres:// URL). */
export function databaseProvider(url: string | undefined | null): DatabaseProvider | null {
  return describeConnection(url)?.provider ?? null;
}

/** Neon's direct host for a pooled one (`ep-x-pooler.…` → `ep-x.…`); other URLs unchanged. */
export function neonDirectUrl(url: string): string {
  const parsed = parse(url);
  const match = parsed ? NEON_HOST.exec(parsed.host) : null;
  const endpoint = match?.[1];
  if (!parsed || !endpoint || !match[2]) return url;
  return parsed.withHost(parsed.host.replace(`${endpoint}${NEON_POOLER_SUFFIX}`, endpoint));
}

/** Neon accepts TLS connections only: true when the URL must use `ssl: 'require'`. */
export function requiresTls(url: string): boolean {
  return databaseProvider(url) === DatabaseProvider.Neon;
}

/**
 * True for connections through a transaction-mode pooler (Supabase shared
 * transaction pooler, Neon pooled host): no SQL PREPARE, session settings or
 * session advisory locks there.
 */
export function isTransactionPooler(url: string): boolean {
  const kind = describeConnection(url)?.kind;
  return kind === ConnectionKind.SharedTransaction || kind === ConnectionKind.NeonPooled;
}

/**
 * URL for migrations, admin scripts and the deploy lock: `DIRECT_URL` if set;
 * for the Supabase shared transaction pooler the same address in session mode
 * (port 5432, same host and user: DDL and advisory locks need a session); for a
 * Neon pooled host the direct host; otherwise `DATABASE_URL`.
 */
export function migrationUrl(source: {
  readonly DATABASE_URL?: string;
  readonly DIRECT_URL?: string;
}): string | undefined {
  const direct = source.DIRECT_URL?.trim();
  if (direct) return direct;
  const database = source.DATABASE_URL?.trim();
  if (!database) return undefined;
  const kind = describeConnection(database)?.kind;
  if (kind === ConnectionKind.NeonPooled) return neonDirectUrl(database);
  if (kind !== ConnectionKind.SharedTransaction) return database;
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

/**
 * Which database a URL points to, whatever the route (pooled or direct, session or
 * transaction port): `supabase:<ref>/<db>`, `<neon direct host>/<db>`, `<host>:<port>/<db>`.
 * Used to refuse copying a database onto itself (`db:clone`).
 */
export function databaseIdentity(url: string): string | null {
  const parsed = parse(url);
  const info = describeConnection(url);
  if (!parsed || !info) return null;
  const name = /^\/([^/?#]*)/.exec(parsed.path)?.[1] || 'postgres';
  if (info.projectRef) return `supabase:${info.projectRef}/${name}`;
  if (info.provider === DatabaseProvider.Neon)
    return `${parse(neonDirectUrl(url))?.host ?? parsed.host}/${name}`;
  return `${parsed.host}:${parsed.port}/${name}`;
}

/** A connection string with the password replaced, for logs and messages. */
export function maskConnectionString(url: string): string {
  return parse(url)?.masked ?? '(not a postgres:// URL)';
}
