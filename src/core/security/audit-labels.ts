import { AuditAction } from './audit-actions';

/** Human-readable labels for audit actions (admin UI). */
const LABELS: Record<AuditAction, string> = {
  [AuditAction.LoginSuccess]: 'Signed in',
  [AuditAction.LoginFailure]: 'Failed sign-in',
  [AuditAction.LoginLocked]: 'Sign-in locked (too many attempts)',
  [AuditAction.Logout]: 'Signed out',
  [AuditAction.PasswordChange]: 'Changed password',
  [AuditAction.TwoFactorEnable]: 'Turned on two-factor authentication',
  [AuditAction.TwoFactorDisable]: 'Turned off two-factor authentication',
  [AuditAction.SessionRevoke]: 'Revoked a session',
  [AuditAction.UserCreate]: 'Created a user',
  [AuditAction.UserUpdate]: 'Updated a user',
  [AuditAction.UserDisable]: 'Disabled a user',
  [AuditAction.UserEnable]: 'Enabled a user',
  [AuditAction.UserDelete]: 'Deleted a user',
  [AuditAction.UserPasswordReset]: 'Reset a password',
  [AuditAction.UserSessionsRevoke]: 'Revoked a user’s sessions',
  [AuditAction.ContentSave]: 'Saved content',
  [AuditAction.ContentRestore]: 'Restored a revision',
  [AuditAction.ItemCreate]: 'Created an item',
  [AuditAction.ItemPublish]: 'Published an item',
  [AuditAction.ItemUnpublish]: 'Unpublished an item',
  [AuditAction.ItemDelete]: 'Deleted an item',
  [AuditAction.SeoSave]: 'Saved page SEO',
  [AuditAction.MediaUpload]: 'Uploaded an image',
  [AuditAction.MediaDelete]: 'Deleted an image',
  [AuditAction.SettingsSave]: 'Changed settings',
  [AuditAction.DatabaseConnect]: 'Connected a database',
};

export function auditActionLabel(action: string): string {
  return (LABELS as Record<string, string>)[action] ?? action;
}
