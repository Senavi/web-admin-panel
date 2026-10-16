import 'server-only';

import { eq } from 'drizzle-orm';

import { getAuthSecret } from '@/core/auth/secret';
import { integrationSecrets } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

import { decryptSecret, encryptSecret, secretHint } from './crypto';

export const SecretName = {
  ResendApiKey: 'resend.apiKey',
  SmtpPassword: 'smtp.password',
} as const;
export type SecretName = (typeof SecretName)[keyof typeof SecretName];

export const SecretState = {
  None: 'none',
  Set: 'set',
  /** Stored, but the auth secret changed: ask to enter it again. */
  Unreadable: 'unreadable',
} as const;
export type SecretState = (typeof SecretState)[keyof typeof SecretState];

export interface SecretInfo {
  readonly state: SecretState;
  /** `••••1234`; never the value. */
  readonly hint: string;
}

/** What the admin may know about stored secrets: whether they exist and are readable. */
export async function readSecretInfos(db: Database): Promise<Record<SecretName, SecretInfo>> {
  const rows = await db.select().from(integrationSecrets);
  const authSecret = getAuthSecret();
  const result = Object.fromEntries(
    Object.values(SecretName).map((name) => [name, { state: SecretState.None, hint: '' }]),
  ) as Record<SecretName, SecretInfo>;
  for (const row of rows) {
    if (!(row.name in result)) continue;
    const readable = decryptSecret(authSecret, row.name, row.value) !== null;
    result[row.name as SecretName] = {
      state: readable ? SecretState.Set : SecretState.Unreadable,
      hint: row.hint,
    };
  }
  return result;
}

/** The plain value, for server-side use only. */
export async function readSecret(db: Database, name: SecretName): Promise<string | null> {
  const [row] = await db.select().from(integrationSecrets).where(eq(integrationSecrets.name, name));
  return row ? decryptSecret(getAuthSecret(), name, row.value) : null;
}

export async function writeSecret(
  db: Database,
  input: { name: SecretName; value: string; userId: string },
): Promise<void> {
  const value = encryptSecret(getAuthSecret(), input.name, input.value);
  const hint = secretHint(input.value);
  await db
    .insert(integrationSecrets)
    .values({ name: input.name, value, hint, updatedBy: input.userId })
    .onConflictDoUpdate({
      target: integrationSecrets.name,
      set: { value, hint, updatedAt: new Date(), updatedBy: input.userId },
    });
}

export async function deleteSecret(db: Database, name: SecretName): Promise<void> {
  await db.delete(integrationSecrets).where(eq(integrationSecrets.name, name));
}
