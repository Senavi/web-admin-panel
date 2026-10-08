'use server';

import { ActionErrorCode, fail, ok, type ActionResult } from '@/core/actions/result';
import { GuardError, runAction } from '@/core/actions/run';
import { Permission } from '@/core/auth/permissions';
import { assertPermission } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import { isProduction } from '@/core/env';
import { AuditAction, writeAudit } from '@/core/security/audit';

import {
  type CheckResult,
  migrateDataToSupabase,
  migrateSupabase,
  secureSupabase,
  supabaseConnectionSchema,
  testSupabaseConnection,
  writeEnvLocal,
} from './supabase-connect';

/**
 * Connect Supabase wizard steps. Development only (production env vars are set
 * on the hosting platform); admins only. Secrets are never logged or stored in
 * the database.
 */
async function guard(input: unknown) {
  const actor = await assertPermission(Permission.SecurityManage);
  if (isProduction())
    throw new GuardError(
      'Connect Supabase is only available in development.',
      ActionErrorCode.Unauthorized,
    );
  return { actor, connection: supabaseConnectionSchema.parse(input) };
}

const failure = (error: unknown) =>
  fail(error instanceof Error ? error.message : 'The step failed.');

export async function testSupabaseAction(input: unknown): Promise<ActionResult<CheckResult[]>> {
  return runAction(async () => {
    const { connection } = await guard(input);
    return ok(await testSupabaseConnection(connection));
  });
}

export async function migrateSupabaseAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const { connection } = await guard(input);
    try {
      await migrateSupabase(connection);
    } catch (error) {
      return failure(error);
    }
    return ok(undefined, 'Migrations applied.');
  });
}

export async function migrateSupabaseDataAction(
  input: unknown,
): Promise<ActionResult<{ rows: Record<string, number>; files: number }>> {
  return runAction(async () => {
    const { connection } = await guard(input);
    try {
      return ok(await migrateDataToSupabase(connection), 'Data copied.');
    } catch (error) {
      return failure(error);
    }
  });
}

export async function secureSupabaseAction(
  input: unknown,
): Promise<ActionResult<{ tables: string[] }>> {
  return runAction(async () => {
    const { connection } = await guard(input);
    try {
      return ok(
        await secureSupabase(connection),
        'Row Level Security enabled and bucket configured.',
      );
    } catch (error) {
      return failure(error);
    }
  });
}

export async function writeSupabaseEnvAction(
  input: unknown,
): Promise<ActionResult<{ variables: string[] }>> {
  return runAction(async () => {
    const { actor, connection } = await guard(input);
    const variables = writeEnvLocal(connection);
    await writeAudit(await getDb(), {
      action: AuditAction.DatabaseConnect,
      actor: { id: actor.id, email: actor.email },
      target: 'env:.env.local',
      summary: { variables },
    });
    return ok({ variables }, 'Saved to .env.local. Restart the dev server to use Supabase.');
  });
}
