'use server';

import { ActionErrorCode, fail, ok, type ActionResult } from '@/core/actions/result';
import { GuardError, runAction } from '@/core/actions/run';
import { Permission } from '@/core/auth/permissions';
import { assertPermission } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import { z } from 'zod';

import { migrationUrl } from '@/core/db/connection-info';
import { isProduction } from '@/core/env';
import { AuditAction, writeAudit } from '@/core/security/audit';

import {
  type CheckResult,
  migrateDataToSupabase,
  migrateSupabase,
  remoteContentSummary,
  secureSupabase,
  supabaseConnectionSchema,
  testSupabaseConnection,
  writeEnvLocal,
} from './supabase-connect';
import {
  neonConnectionSchema,
  neonEnvironmentSchema,
  prepareNeonProduction,
  testNeonEnvironment,
} from './neon-connect';
import type { RemoteContentSummary } from './remote-summary';

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

/** Same guard for the Neon steps: admins only, development only, input validated. */
async function neonGuard<T extends z.ZodType>(schema: T, input: unknown) {
  const actor = await assertPermission(Permission.SecurityManage);
  if (isProduction())
    throw new GuardError(
      'Connect a database is only available in development.',
      ActionErrorCode.Unauthorized,
    );
  return { actor, data: schema.parse(input) };
}

const failure = (error: unknown) =>
  fail(error instanceof Error ? error.message : 'The step failed.');

export async function testSupabaseAction(input: unknown): Promise<ActionResult<CheckResult[]>> {
  return runAction(async () => {
    const { connection } = await guard(input);
    return ok(await testSupabaseConnection(connection));
  });
}

/** What the online database already holds (shown before copying local content). */
export async function inspectSupabaseTargetAction(
  input: unknown,
): Promise<ActionResult<RemoteContentSummary>> {
  return runAction(async () => {
    const { connection } = await guard(input);
    try {
      return ok(await remoteContentSummary(connection));
    } catch (error) {
      return failure(error);
    }
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

/** Neon step: checks production and staging (pooled, direct, storage). */
export async function testNeonAction(input: unknown): Promise<ActionResult<CheckResult[]>> {
  return runAction(async () => {
    const { data } = await neonGuard(neonConnectionSchema, input);
    const [production, staging] = await Promise.all([
      testNeonEnvironment('Production', data.production),
      testNeonEnvironment('Staging', data.staging),
    ]);
    return ok([...production, ...staging]);
  });
}

const prepareNeonSchema = z.object({
  production: neonEnvironmentSchema,
  copyLocal: z.boolean().default(false),
});

/** Neon step: migrates the production branch and optionally copies this computer's content. */
export async function prepareNeonAction(
  input: unknown,
): Promise<ActionResult<{ rows: Record<string, number>; files: number }>> {
  return runAction(async () => {
    const { actor, data } = await neonGuard(prepareNeonSchema, input);
    let result: { rows: Record<string, number>; files: number };
    try {
      result = await prepareNeonProduction(data.production, data.copyLocal);
    } catch (error) {
      return failure(error);
    }
    await writeAudit(await getDb(), {
      action: AuditAction.DatabaseConnect,
      actor: { id: actor.id, email: actor.email },
      target: 'neon:production',
      summary: { copiedLocal: data.copyLocal, files: result.files },
    });
    return ok(
      result,
      data.copyLocal ? 'Database prepared and content copied.' : 'Database prepared.',
    );
  });
}

/** What the Neon production branch already holds (shown before copying local content). */
export async function inspectNeonAction(
  input: unknown,
): Promise<ActionResult<RemoteContentSummary>> {
  return runAction(async () => {
    const { data } = await neonGuard(neonEnvironmentSchema, input);
    const directUrl = migrationUrl({ DATABASE_URL: data.databaseUrl }) ?? data.databaseUrl;
    try {
      return ok(await remoteContentSummary({ directUrl }));
    } catch (error) {
      return failure(error);
    }
  });
}
