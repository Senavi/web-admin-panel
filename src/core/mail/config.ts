import 'server-only';

import { env, isProduction, MailProvider } from '@/core/env';
import { EmailProviderKind, SmtpSecurity } from '@/core/integrations/model';
import { readSecret, SecretName } from '@/core/integrations/secrets';
import { readSiteSettings } from '@/core/settings/repository';
import type { Database } from '@/core/db/types';

/** Where the email provider comes from. */
export const MailSource = {
  /** `MAIL_PROVIDER=resend|smtp` on the server: wins over everything. */
  Env: 'env',
  /** Configured in Settings → Integrations. */
  Integrations: 'integrations',
  /** Development: emails are saved as files. */
  Dev: 'dev',
  None: 'none',
} as const;
export type MailSource = (typeof MailSource)[keyof typeof MailSource];

export const DEFAULT_MAIL_FROM = 'Website <forms@localhost>';
export const DEFAULT_SMTP_PORT = 587;

export type MailConfig =
  | { readonly source: typeof MailSource.None }
  | { readonly source: typeof MailSource.Dev; readonly from: string }
  | {
      readonly source: typeof MailSource.Env | typeof MailSource.Integrations;
      readonly provider: typeof MailProvider.Resend;
      readonly from: string;
      /** Null when the stored key cannot be read (the auth secret changed). */
      readonly apiKey: string | null;
    }
  | {
      readonly source: typeof MailSource.Env | typeof MailSource.Integrations;
      readonly provider: typeof MailProvider.Smtp;
      readonly from: string;
      readonly host: string;
      readonly port: number;
      readonly security: SmtpSecurity;
      readonly user: string;
      /** Null when the stored password cannot be read; '' when none is needed. */
      readonly password: string | null;
    };

/**
 * The email provider in use. Order: `MAIL_PROVIDER=resend|smtp` in env, then the
 * provider connected in Settings → Integrations, then development files
 * (`MAIL_PROVIDER=dev`, or any non-production run), then none.
 */
export async function resolveMailConfig(db: Database): Promise<MailConfig> {
  const variables = env();
  const envFrom = variables.MAIL_FROM ?? DEFAULT_MAIL_FROM;
  if (variables.MAIL_PROVIDER === MailProvider.Resend) {
    return {
      source: MailSource.Env,
      provider: MailProvider.Resend,
      from: envFrom,
      apiKey: variables.RESEND_API_KEY ?? null,
    };
  }
  if (variables.MAIL_PROVIDER === MailProvider.Smtp) {
    const port = variables.SMTP_PORT ?? DEFAULT_SMTP_PORT;
    return {
      source: MailSource.Env,
      provider: MailProvider.Smtp,
      from: envFrom,
      host: variables.SMTP_HOST ?? '',
      port,
      security: port === 465 ? SmtpSecurity.Ssl : SmtpSecurity.StartTls,
      user: variables.SMTP_USER ?? '',
      password: variables.SMTP_PASSWORD ?? '',
    };
  }

  const { email } = (await readSiteSettings(db)).integrations;
  if (email.provider === EmailProviderKind.Resend) {
    return {
      source: MailSource.Integrations,
      provider: MailProvider.Resend,
      from: email.from,
      apiKey: await readSecret(db, SecretName.ResendApiKey),
    };
  }
  if (email.provider === EmailProviderKind.Smtp) {
    const stored = await readSecret(db, SecretName.SmtpPassword);
    return {
      source: MailSource.Integrations,
      provider: MailProvider.Smtp,
      from: email.from,
      host: email.smtp.host,
      port: email.smtp.port,
      security: email.smtp.security,
      user: email.smtp.user,
      // No user means no password is needed.
      password: email.smtp.user ? stored : '',
    };
  }

  if (variables.MAIL_PROVIDER === MailProvider.Dev || !isProduction())
    return { source: MailSource.Dev, from: envFrom };
  return { source: MailSource.None };
}
