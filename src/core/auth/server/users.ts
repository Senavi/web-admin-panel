import 'server-only';

import { hashPassword } from 'better-auth/crypto';
import { and, eq, sql } from 'drizzle-orm';

import { accounts, sessions, users } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

import { checkPassword } from '../password-policy';
import { type Role, UserStatus } from '../roles';

/** Better Auth's provider id for email + password accounts. */
export const CREDENTIAL_PROVIDER_ID = 'credential';

export class PasswordPolicyError extends Error {}

export interface CreateUserInput {
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly password: string;
  /** Temporary passwords force a change on first login. */
  readonly mustChangePassword: boolean;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Creates a user with an email/password account (same storage format as
 * Better Auth, hashed with its memory-hard scrypt implementation).
 * There is no public sign-up: this is the only way users are created.
 */
export async function createUserWithPassword(db: Database, input: CreateUserInput) {
  const email = normalizeEmail(input.email);
  const check = checkPassword(input.password, { email });
  if (!check.ok) throw new PasswordPolicyError(check.message);

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        id,
        email,
        name: input.name.trim(),
        role: input.role,
        emailVerified: true,
        mustChangePassword: input.mustChangePassword,
      })
      .returning();
    await tx.insert(accounts).values({
      id: crypto.randomUUID(),
      userId: id,
      accountId: id,
      providerId: CREDENTIAL_PROVIDER_ID,
      password: passwordHash,
    });
    if (!user) throw new Error('Failed to create user.');
    return user;
  });
}

export async function findUserByEmail(db: Database, email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)));
  return user ?? null;
}

export async function findUserById(db: Database, id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ?? null;
}

/**
 * Invalidates every credential of a user: deletes all sessions and bumps
 * `sessionVersion` so signed site-gate cookies stop working too.
 */
export async function revokeAllSessions(db: Database, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, userId));
  });
}

/** Sets a new password (validated) and revokes all sessions. */
export async function setPassword(
  db: Database,
  userId: string,
  password: string,
  options: { email: string; mustChangePassword: boolean },
): Promise<void> {
  const check = checkPassword(password, { email: options.email });
  if (!check.ok) throw new PasswordPolicyError(check.message);
  const passwordHash = await hashPassword(password);
  await db
    .update(accounts)
    .set({ password: passwordHash })
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, CREDENTIAL_PROVIDER_ID)));
  await db
    .update(users)
    .set({ mustChangePassword: options.mustChangePassword })
    .where(eq(users.id, userId));
  await revokeAllSessions(db, userId);
}

export async function setUserStatus(
  db: Database,
  userId: string,
  status: UserStatus,
): Promise<void> {
  await db.update(users).set({ status }).where(eq(users.id, userId));
  if (status === UserStatus.Disabled) await revokeAllSessions(db, userId);
}
