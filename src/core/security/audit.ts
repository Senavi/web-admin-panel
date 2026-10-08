import 'server-only';

import { auditLog, type JsonObject } from '@/core/db/schema';
import type { Database } from '@/core/db/types';

/** Audit actions. Use these constants; never free-form strings. */
export const AuditAction = {
  LoginSuccess: 'auth.login.success',
  LoginFailure: 'auth.login.failure',
  LoginLocked: 'auth.login.locked',
  Logout: 'auth.logout',
  PasswordChange: 'auth.password.change',
  TwoFactorEnable: 'auth.2fa.enable',
  TwoFactorDisable: 'auth.2fa.disable',
  SessionRevoke: 'auth.session.revoke',
  UserCreate: 'user.create',
  UserUpdate: 'user.update',
  UserDisable: 'user.disable',
  UserEnable: 'user.enable',
  UserDelete: 'user.delete',
  UserPasswordReset: 'user.password.reset',
  UserSessionsRevoke: 'user.sessions.revoke',
  ContentSave: 'content.save',
  ContentRestore: 'content.restore',
  SeoSave: 'seo.save',
  MediaUpload: 'media.upload',
  MediaDelete: 'media.delete',
  SettingsSave: 'settings.save',
  DatabaseConnect: 'database.connect',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditEntry {
  readonly action: AuditAction;
  readonly actor?: { readonly id: string; readonly email: string } | null;
  /** Free-form target reference, e.g. `user:<id>`, `page:home:uk`, `settings:general`. */
  readonly target?: string;
  /** Short, non-secret summary of the change. */
  readonly summary?: JsonObject;
  readonly ipHash?: string | null;
}

export async function writeAudit(db: Database, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    action: entry.action,
    actorId: entry.actor?.id ?? null,
    actorEmail: entry.actor?.email ?? null,
    target: entry.target ?? null,
    summary: entry.summary ?? null,
    ipHash: entry.ipHash ?? null,
  });
}
