import 'server-only';

import type { Database } from '@/core/db/types';
import { MailProvider } from '@/core/env';
import { MailSource, resolveMailConfig } from '@/core/mail/config';

export interface MailStatus {
  /** False when no provider is connected: requests are saved but not emailed. */
  readonly configured: boolean;
  /** Where the provider comes from; null when none. */
  readonly source: MailSource;
  /** Developer-facing description (Settings → Requests in developer mode). */
  readonly line: string;
}

/** How form emails are sent right now. */
export async function mailStatus(db: Database): Promise<MailStatus> {
  const config = await resolveMailConfig(db);
  switch (config.source) {
    case MailSource.None:
      return {
        configured: false,
        source: config.source,
        line: 'Not connected: add an email provider in Settings → Integrations. Requests are still saved.',
      };
    case MailSource.Dev:
      return {
        configured: true,
        source: config.source,
        line: 'Development: emails are saved as files in the local data folder (mail/).',
      };
    case MailSource.Env:
    case MailSource.Integrations: {
      const where = config.source === MailSource.Env ? 'set on the server' : 'Integrations';
      const name =
        config.provider === MailProvider.Resend ? 'Resend' : `SMTP (${config.host || 'no server'})`;
      return {
        configured: true,
        source: config.source,
        line: `${name} · ${config.from || 'no sender'} · ${where}`,
      };
    }
  }
}
