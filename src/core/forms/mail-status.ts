import 'server-only';

import { env, isProduction, MailProvider } from '@/core/env';

export interface MailStatus {
  /** False when production has no provider: requests are saved but not emailed. */
  readonly configured: boolean;
  /** Developer-facing description (Settings → Requests in developer mode). */
  readonly line: string;
}

/** How form emails are sent in this environment. */
export function mailStatus(): MailStatus {
  const { MAIL_PROVIDER, MAIL_FROM, SMTP_HOST } = env();
  const provider = MAIL_PROVIDER ?? (isProduction() ? null : MailProvider.Dev);
  switch (provider) {
    case MailProvider.Resend:
      return { configured: true, line: `Resend · ${MAIL_FROM ?? 'MAIL_FROM not set'}` };
    case MailProvider.Smtp:
      return {
        configured: true,
        line: `SMTP (${SMTP_HOST ?? 'SMTP_HOST not set'}) · ${MAIL_FROM ?? 'MAIL_FROM not set'}`,
      };
    case MailProvider.Dev:
      return {
        configured: true,
        line: 'Development: emails are saved as files in the local data folder (mail/).',
      };
    case null:
      return {
        configured: false,
        line: 'Not configured: set MAIL_PROVIDER (resend or smtp). Requests are still saved.',
      };
  }
}
