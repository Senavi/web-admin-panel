import 'server-only';

import { contentRegistry } from '@/core/content/project-registry';
import { mailStatus, type MailStatus } from '@/core/forms/mail-status';

import { checkDatabase, checkStorage, type DatabaseHealth, type StorageHealth } from './health';

export interface SiteHealth {
  readonly database: DatabaseHealth;
  readonly storage: StorageHealth;
  readonly mail: MailStatus;
  /** Plain-language problems for the Security status card; empty when everything works. */
  readonly problems: readonly string[];
  /** What "everything works" covers, e.g. "Database, file storage and email are connected." */
  readonly okText: string;
}

/**
 * One status for the Security page: database, file storage and email. Required
 * production variables are enforced at startup (env schema), so they are not
 * repeated here.
 */
export async function checkSiteHealth(): Promise<SiteHealth> {
  const [database, storage] = await Promise.all([checkDatabase(), checkStorage()]);
  const mail = mailStatus();
  const usesEmail = contentRegistry.forms.length > 0;

  const problems: string[] = [];
  if (!database.ok) {
    problems.push(
      database.hint ?? 'The database doesn’t answer. Changes can’t be saved right now.',
    );
  }
  if (!storage.ok)
    problems.push('File storage doesn’t answer. Images can’t be uploaded right now.');
  if (usesEmail && !mail.configured)
    problems.push('Email is not set up. New requests are saved here but not sent by email.');

  return {
    database,
    storage,
    mail,
    problems,
    okText: usesEmail
      ? 'Database, file storage and email are connected.'
      : 'Database and file storage are connected.',
  };
}
