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
  [AuditAction.SubmissionStatus]: 'Changed a form submission',
  [AuditAction.SubmissionDelete]: 'Deleted a form submission',
  [AuditAction.SubmissionExport]: 'Exported form submissions',
  [AuditAction.SeoSave]: 'Saved page SEO',
  [AuditAction.MediaUpload]: 'Uploaded an image',
  [AuditAction.MediaDelete]: 'Deleted an image',
  [AuditAction.SettingsSave]: 'Changed settings',
  [AuditAction.DatabaseConnect]: 'Connected a database',
};

export function auditActionLabel(action: string): string {
  return (LABELS as Record<string, string>)[action] ?? action;
}

/** Plain-language sentence parts: `{actor} {verb}[ {target}]` ("Ann changed settings"). */
const VERBS: Record<AuditAction, string> = {
  [AuditAction.LoginSuccess]: 'signed in',
  [AuditAction.LoginFailure]: 'tried to sign in with a wrong password',
  [AuditAction.LoginLocked]: 'was blocked after too many wrong passwords',
  [AuditAction.Logout]: 'signed out',
  [AuditAction.PasswordChange]: 'changed their password',
  [AuditAction.TwoFactorEnable]: 'turned on two-factor sign-in',
  [AuditAction.TwoFactorDisable]: 'turned off two-factor sign-in',
  [AuditAction.SessionRevoke]: 'signed out a device',
  [AuditAction.UserCreate]: 'added',
  [AuditAction.UserUpdate]: 'changed',
  [AuditAction.UserDisable]: 'blocked',
  [AuditAction.UserEnable]: 'unblocked',
  [AuditAction.UserDelete]: 'removed',
  [AuditAction.UserPasswordReset]: 'reset the password of',
  [AuditAction.UserSessionsRevoke]: 'signed out every device of',
  [AuditAction.ContentSave]: 'changed',
  [AuditAction.ContentRestore]: 'restored an earlier version of',
  [AuditAction.ItemCreate]: 'created',
  [AuditAction.ItemPublish]: 'published',
  [AuditAction.ItemUnpublish]: 'unpublished',
  [AuditAction.ItemDelete]: 'deleted',
  [AuditAction.SubmissionStatus]: 'updated a request in',
  [AuditAction.SubmissionDelete]: 'deleted a request from',
  [AuditAction.SubmissionExport]: 'downloaded the requests of',
  [AuditAction.SeoSave]: 'changed the Google settings of',
  [AuditAction.MediaUpload]: 'uploaded an image',
  [AuditAction.MediaDelete]: 'deleted an image',
  [AuditAction.SettingsSave]: 'changed the settings',
  [AuditAction.DatabaseConnect]: 'connected a new database',
};

/** Actions whose target is not worth naming in a sentence (self, settings group…). */
const NO_TARGET = new Set<string>([
  AuditAction.LoginSuccess,
  AuditAction.LoginFailure,
  AuditAction.LoginLocked,
  AuditAction.Logout,
  AuditAction.PasswordChange,
  AuditAction.TwoFactorEnable,
  AuditAction.TwoFactorDisable,
  AuditAction.SessionRevoke,
  AuditAction.MediaUpload,
  AuditAction.MediaDelete,
  AuditAction.SettingsSave,
  AuditAction.DatabaseConnect,
]);

/**
 * One activity entry as a sentence, e.g. "Ann changed Home (uk)". `self` marks
 * a user acting on their own account ("Ann updated their account").
 */
export function auditSentence(
  action: string,
  actor: string | null,
  target: string | null,
  self = false,
): string {
  const verb = (VERBS as Record<string, string>)[action];
  const who = actor ?? 'Someone';
  if (self && action === AuditAction.UserUpdate) return `${who} updated their account`;
  if (!verb) return `${who}: ${auditActionLabel(action)}${target ? ` · ${target}` : ''}`;
  return target && !NO_TARGET.has(action) ? `${who} ${verb} ${target}` : `${who} ${verb}`;
}
