import { describe, expect, it } from 'vitest';

import { supabaseConnectionSchema } from '@/core/database/supabase-connect';
import { AuditAction } from '@/core/security/audit-actions';
import { auditSentence } from '@/core/security/audit-labels';

describe('activity sentences', () => {
  it('names who did what to which target', () => {
    expect(auditSentence(AuditAction.ContentSave, 'Ann', 'Home (uk)')).toBe(
      'Ann changed Home (uk)',
    );
    expect(auditSentence(AuditAction.UserCreate, 'Ann', 'Bob (bob@example.com)')).toBe(
      'Ann added Bob (bob@example.com)',
    );
    expect(auditSentence(AuditAction.UserUpdate, 'Ann', 'Ann (ann@example.com)', true)).toBe(
      'Ann updated their account',
    );
  });

  it('leaves out targets that add nothing and falls back for unknown actors/actions', () => {
    expect(auditSentence(AuditAction.SettingsSave, 'Ann', 'settings:general')).toBe(
      'Ann changed the settings',
    );
    expect(auditSentence(AuditAction.LoginFailure, null, null)).toBe(
      'Someone tried to sign in with a wrong password',
    );
    expect(auditSentence('custom.thing', 'Ann', 'x')).toBe('Ann: custom.thing · x');
  });
});

describe('Connect Supabase keys', () => {
  const keys = {
    serviceRoleKey: 'service-role-key-0123456789',
    databaseUrl:
      'postgresql://postgres.xyz:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
  };

  it('accepts a missing or empty anon key', () => {
    expect(supabaseConnectionSchema.parse(keys).anonKey).toBeUndefined();
    expect(supabaseConnectionSchema.parse({ ...keys, anonKey: '  ' }).anonKey).toBeUndefined();
  });

  it('derives the project URL and the session-mode migration URL from one connection string', () => {
    const parsed = supabaseConnectionSchema.parse(keys);
    expect(parsed.supabaseUrl).toBe('https://xyz.supabase.co');
    expect(parsed.directUrl).toBe(keys.databaseUrl.replace(':6543/', ':5432/'));
  });

  it('rejects connection strings that are not from Supabase', () => {
    const result = supabaseConnectionSchema.safeParse({
      ...keys,
      databaseUrl: 'postgres://postgres:postgres@localhost:5432/app',
    });
    expect(result.success).toBe(false);
  });

  it('still validates an anon key when given', () => {
    expect(supabaseConnectionSchema.safeParse({ ...keys, anonKey: 'short' }).success).toBe(false);
  });
});
