import { describe, expect, it } from 'vitest';

import {
  ConnectionKind,
  connectionErrorHint,
  DatabaseProvider,
  databaseProvider,
  isTransactionPooler,
  neonDirectUrl,
  requiresTls,
  deriveSupabaseUrl,
  describeConnection,
  IPV6_ONLY_MESSAGE,
  isNetworkError,
  maskConnectionString,
  migrationUrl,
  migrationUrlProblem,
  resolveSupabaseUrl,
} from '@/core/db/connection-info';

const REF = 'abcdefghijklmnopqrst';
const SHARED_TX = `postgresql://postgres.${REF}:s3cret%40pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
const SHARED_SESSION = `postgresql://postgres.${REF}:s3cret@aws-1-us-east-2.pooler.supabase.com:5432/postgres`;
const DIRECT = `postgresql://postgres:s3cret@db.${REF}.supabase.co:5432/postgres`;
const DEDICATED = `postgresql://postgres:s3cret@db.${REF}.supabase.co:6543/postgres`;
const CI = 'postgres://postgres:postgres@localhost:5432/app';
const PGLITE = 'postgres://postgres:postgres@127.0.0.1:54329/postgres';
const NEON_POOLED =
  'postgresql://neondb_owner:npg_s3cret@ep-cool-darkness-a1b2c3d4-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const NEON_DIRECT = NEON_POOLED.replace('-pooler.', '.');

describe('describeConnection', () => {
  it('recognizes the four Supabase connection types', () => {
    expect(describeConnection(SHARED_TX)).toEqual({
      kind: ConnectionKind.SharedTransaction,
      provider: DatabaseProvider.Supabase,
      projectRef: REF,
      ipv4: true,
    });
    expect(describeConnection(SHARED_SESSION)).toEqual({
      kind: ConnectionKind.SharedSession,
      provider: DatabaseProvider.Supabase,
      projectRef: REF,
      ipv4: true,
    });
    expect(describeConnection(DIRECT)).toEqual({
      kind: ConnectionKind.Direct,
      provider: DatabaseProvider.Supabase,
      projectRef: REF,
      ipv4: false,
    });
    expect(describeConnection(DEDICATED)).toEqual({
      kind: ConnectionKind.Dedicated,
      provider: DatabaseProvider.Supabase,
      projectRef: REF,
      ipv4: false,
    });
  });

  it('treats other Postgres servers (CI, local PGlite server) as reachable', () => {
    expect(describeConnection(CI)).toEqual({
      kind: ConnectionKind.OtherPostgres,
      provider: DatabaseProvider.Postgres,
      ipv4: true,
    });
    expect(describeConnection(PGLITE)?.kind).toBe(ConnectionKind.OtherPostgres);
  });

  it('copes with unencoded special characters in the password', () => {
    const raw = `postgresql://postgres.${REF}:p@ss/w#rd@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
    expect(describeConnection(raw)?.kind).toBe(ConnectionKind.SharedTransaction);
    expect(describeConnection(raw)?.projectRef).toBe(REF);
  });

  it('returns null for anything that is not a postgres URL', () => {
    expect(describeConnection(undefined)).toBeNull();
    expect(describeConnection('')).toBeNull();
    expect(describeConnection('https://example.com')).toBeNull();
  });
});

describe('migrationUrl', () => {
  it('prefers DIRECT_URL', () => {
    expect(migrationUrl({ DATABASE_URL: SHARED_TX, DIRECT_URL: DIRECT })).toBe(DIRECT);
  });

  it('switches the shared transaction pooler to session mode (port 5432), keeping the password', () => {
    expect(migrationUrl({ DATABASE_URL: SHARED_TX })).toBe(SHARED_TX.replace(':6543/', ':5432/'));
  });

  it('uses other URLs as they are', () => {
    for (const url of [SHARED_SESSION, DIRECT, DEDICATED, CI])
      expect(migrationUrl({ DATABASE_URL: url })).toBe(url);
    expect(migrationUrl({})).toBeUndefined();
  });
});

describe('migrationUrlProblem', () => {
  const BOUNCER = 'postgres://app:pw@db.example.com:6432/site';

  it('requires DIRECT_URL behind a self-hosted transaction pooler', () => {
    expect(migrationUrlProblem({ DATABASE_URL: BOUNCER })).toMatch(/Set DIRECT_URL/);
    expect(migrationUrlProblem({ DATABASE_URL: `${CI}?pgbouncer=true` })).toMatch(/DIRECT_URL/);
    expect(migrationUrlProblem({ DATABASE_URL: DEDICATED })).toMatch(/DIRECT_URL/);
    expect(
      migrationUrlProblem({ DATABASE_URL: BOUNCER, DIRECT_URL: BOUNCER.replace(':6432', ':5432') }),
    ).toBeNull();
  });

  it('accepts addresses whose direct URL is known or derived', () => {
    for (const url of [SHARED_TX, SHARED_SESSION, DIRECT, CI, NEON_POOLED, NEON_DIRECT])
      expect(migrationUrlProblem({ DATABASE_URL: url })).toBeNull();
    expect(migrationUrlProblem({})).toBeNull();
  });
});

describe('Supabase project URL', () => {
  it('is derived from the pooler user or the db host; an explicit value wins', () => {
    expect(deriveSupabaseUrl(SHARED_TX)).toBe(`https://${REF}.supabase.co`);
    expect(deriveSupabaseUrl(DIRECT)).toBe(`https://${REF}.supabase.co`);
    expect(deriveSupabaseUrl(CI)).toBeNull();
    expect(resolveSupabaseUrl({ DATABASE_URL: SHARED_TX })).toBe(`https://${REF}.supabase.co`);
    expect(
      resolveSupabaseUrl({ DATABASE_URL: SHARED_TX, SUPABASE_URL: 'https://custom.example.com' }),
    ).toBe('https://custom.example.com');
    expect(resolveSupabaseUrl({ DATABASE_URL: CI })).toBeUndefined();
  });
});

describe('connection errors', () => {
  const unreachable = Object.assign(new Error('connect ENETUNREACH 2a05:d014::1:5432'), {
    code: 'ENETUNREACH',
  });
  const wrapped = new Error('Failed query', { cause: { code: 'CONNECT_TIMEOUT' } });

  it('detects network errors, also when wrapped', () => {
    expect(isNetworkError(unreachable)).toBe(true);
    expect(isNetworkError(wrapped)).toBe(true);
    expect(isNetworkError(new Error('password authentication failed'))).toBe(false);
  });

  it('gives the IPv6 hint only for direct/dedicated addresses', () => {
    expect(connectionErrorHint(unreachable, DIRECT)).toBe(IPV6_ONLY_MESSAGE);
    expect(connectionErrorHint(wrapped, DEDICATED)).toBe(IPV6_ONLY_MESSAGE);
    expect(connectionErrorHint(unreachable, SHARED_TX)).toBeNull();
    expect(connectionErrorHint(new Error('auth failed'), DIRECT)).toBeNull();
  });

  it('never shows the password', () => {
    expect(maskConnectionString(SHARED_TX)).not.toContain('s3cret');
    expect(maskConnectionString(SHARED_TX)).toContain('****@aws-0-eu-central-1');
    expect(IPV6_ONLY_MESSAGE).toContain('pooler.supabase.com:5432');
  });
});

describe('Neon', () => {
  it('recognizes pooled and direct hosts', () => {
    expect(describeConnection(NEON_POOLED)).toEqual({
      kind: ConnectionKind.NeonPooled,
      provider: DatabaseProvider.Neon,
      ipv4: true,
    });
    expect(describeConnection(NEON_DIRECT)?.kind).toBe(ConnectionKind.NeonDirect);
    expect(databaseProvider(NEON_DIRECT)).toBe(DatabaseProvider.Neon);
    expect(databaseProvider(SHARED_SESSION)).toBe(DatabaseProvider.Supabase);
    expect(databaseProvider(CI)).toBe(DatabaseProvider.Postgres);
    expect(databaseProvider('nope')).toBeNull();
    // Azure regions use another domain suffix.
    expect(databaseProvider('postgres://u:p@ep-x-123-pooler.eastus2.azure.neon.tech/neondb')).toBe(
      DatabaseProvider.Neon,
    );
  });

  it('derives the direct URL by removing -pooler, keeping user, password and query', () => {
    expect(neonDirectUrl(NEON_POOLED)).toBe(NEON_DIRECT);
    expect(neonDirectUrl(NEON_DIRECT)).toBe(NEON_DIRECT);
    expect(neonDirectUrl(SHARED_TX)).toBe(SHARED_TX);
    expect(migrationUrl({ DATABASE_URL: NEON_POOLED })).toBe(NEON_DIRECT);
    expect(migrationUrl({ DATABASE_URL: NEON_POOLED, DIRECT_URL: CI })).toBe(CI);
  });

  it('knows transaction poolers and TLS requirements', () => {
    expect(isTransactionPooler(NEON_POOLED)).toBe(true);
    expect(isTransactionPooler(SHARED_TX)).toBe(true);
    expect(isTransactionPooler(NEON_DIRECT)).toBe(false);
    expect(isTransactionPooler(SHARED_SESSION)).toBe(false);
    expect(requiresTls(NEON_POOLED)).toBe(true);
    expect(requiresTls(CI)).toBe(false);
  });
});
