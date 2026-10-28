import 'server-only';

import { contentRegistry } from '@/core/content/project-registry';
import { mailStatus, type MailStatus } from '@/core/forms/mail-status';
import { integrationProblems } from '@/core/integrations/health';
import { MailSource } from '@/core/mail/config';
import { getDb } from '@/core/db/client';
import { usageProblems } from '@/core/database/usage';
import { readUsage, type SiteUsage } from '@/core/database/usage-server';
import { databaseMismatchWarning } from '@/core/deployment/database-check-server';

import { checkDatabase, checkStorage, type DatabaseHealth, type StorageHealth } from './health';

export interface SiteHealth {
  readonly database: DatabaseHealth;
  readonly storage: StorageHealth;
  readonly mail: MailStatus;
  /** Database size and images vs the plan limit (null while the database doesn't answer). */
  readonly usage: SiteUsage | null;
  /** Plain-language problems for the Security status card; empty when everything works. */
  readonly problems: readonly string[];
  /** What "everything works" covers, e.g. "Database, file storage and email are connected." */
  readonly okText: string;
}

const UNKNOWN_MAIL: MailStatus = {
  configured: true,
  source: MailSource.None,
  line: 'Unknown: the database doesn’t answer.',
};

/**
 * One status for the Security page: database, file storage and email. Required
 * production variables are enforced at startup (env schema), so they are not
 * repeated here.
 */
export async function checkSiteHealth(): Promise<SiteHealth> {
  const [database, storage] = await Promise.all([checkDatabase(), checkStorage()]);
  // Mail and integration checks read the database: skip them while it is down.
  const [mail, integrations, usage] = database.ok
    ? await getDb().then((db) =>
        Promise.all([mailStatus(db), integrationProblems(db), readUsage().catch(() => null)]),
      )
    : [UNKNOWN_MAIL, [] as string[], null];
  const usesEmail = contentRegistry.forms.length > 0;

  const problems: string[] = [];
  const mismatch = database.ok ? await databaseMismatchWarning() : null;
  if (mismatch) problems.push(mismatch);
  if (!database.ok) {
    problems.push(
      database.hint ?? 'The database doesn’t answer. Changes can’t be saved right now.',
    );
  }
  if (!storage.ok)
    problems.push('File storage doesn’t answer. Images can’t be uploaded right now.');
  if (usesEmail && !mail.configured)
    problems.push(
      'Email is not connected. New requests are saved here but not sent by email (Settings → Integrations).',
    );
  problems.push(...integrations);
  if (usage?.plan) problems.push(...usageProblems(usage, usage.plan));

  return {
    database,
    storage,
    mail,
    usage,
    problems,
    okText: usesEmail
      ? 'Database, file storage and email are connected.'
      : 'Database and file storage are connected.',
  };
}
