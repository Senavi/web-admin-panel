'use server';

import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { fail, ok, type ActionResult } from '@/core/actions/result';
import { runAction } from '@/core/actions/run';
import { Permission } from '@/core/auth/permissions';
import { assertPermission } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import { settings } from '@/core/db/schema';
import { resolveMailConfig } from '@/core/mail/config';
import { MailNotConfiguredError, sendMail } from '@/core/mail/send';
import { AuditAction, writeAudit } from '@/core/security/audit';
import { readSiteSettings } from '@/core/settings/repository';

import { secretHint } from './crypto';
import { deleteSecret, SecretName, writeSecret } from './secrets';

const MAX_SECRET_LENGTH = 500;

const setSecretSchema = z.object({
  name: z.enum([SecretName.ResendApiKey, SecretName.SmtpPassword]),
  value: z.string().min(1, 'Enter a value.').max(MAX_SECRET_LENGTH),
});
const removeSecretSchema = z.object({ name: setSecretSchema.shape.name });

/**
 * Stores an integration credential, encrypted. Admin only; the value is never
 * returned or written to the audit log.
 */
export async function setIntegrationSecretAction(
  input: unknown,
): Promise<ActionResult<{ hint: string }>> {
  return runAction(async () => {
    const user = await assertPermission(Permission.IntegrationsManage);
    const { name, value } = setSecretSchema.parse(input);
    const db = await getDb();
    await writeSecret(db, { name, value, userId: user.id });
    await writeAudit(db, {
      action: AuditAction.SettingsSave,
      actor: { id: user.id, email: user.email },
      target: 'settings:integrations',
      summary: { secret: name, change: 'replaced' },
    });
    return ok({ hint: secretHint(value) }, 'Saved.');
  });
}

export async function removeIntegrationSecretAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertPermission(Permission.IntegrationsManage);
    const { name } = removeSecretSchema.parse(input);
    const db = await getDb();
    await deleteSecret(db, name);
    await writeAudit(db, {
      action: AuditAction.SettingsSave,
      actor: { id: user.id, email: user.email },
      target: 'settings:integrations',
      summary: { secret: name, change: 'removed' },
    });
    return ok(undefined, 'Removed.');
  });
}

/** Short, secret-free reason for the admin. */
function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Sending failed';
  return message.replace(/\s+/g, ' ').slice(0, 200);
}

/**
 * Sends a test email to the signed-in admin with the provider in use, and
 * remembers the result (shown on the card and in the Security status).
 */
export async function sendTestEmailAction(): Promise<ActionResult<{ to: string }>> {
  return runAction(async () => {
    const user = await assertPermission(Permission.IntegrationsManage);
    const db = await getDb();
    const config = await resolveMailConfig(db);
    const now = new Date();
    let error: string | null = null;
    try {
      await sendMail(config, {
        id: `test-${now.getTime()}`,
        createdAt: now,
        to: [user.email],
        subject: 'Test email from your website',
        text: 'This is a test email. If you can read it, form requests can be sent by email.',
      });
    } catch (caught) {
      error = reasonOf(caught);
      if (caught instanceof MailNotConfiguredError) error = caught.message;
    }
    const current = await readSiteSettings(db);
    const next = {
      ...current,
      integrations: {
        ...current.integrations,
        email: {
          ...current.integrations.email,
          lastCheck: { ok: error === null, at: now.toISOString(), ...(error ? { error } : {}) },
        },
      },
    };
    await db
      .insert(settings)
      .values({ id: 1, data: next, updatedBy: user.id })
      .onConflictDoUpdate({
        target: settings.id,
        set: {
          data: next,
          version: sql`${settings.version} + 1`,
          updatedAt: now,
          updatedBy: user.id,
        },
      });
    await writeAudit(db, {
      action: AuditAction.SettingsSave,
      actor: { id: user.id, email: user.email },
      target: 'settings:integrations',
      summary: { testEmail: error === null ? 'sent' : 'failed' },
    });
    if (error) return fail(`The test email could not be sent: ${error}`);
    return ok({ to: user.email }, `Test email sent to ${user.email}.`);
  });
}
