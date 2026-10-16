import 'server-only';

import { contentRegistry } from '@/core/content/project-registry';
import type { Database } from '@/core/db/types';
import { MailSource, resolveMailConfig } from '@/core/mail/config';
import { readSiteSettings } from '@/core/settings/repository';
import type { SiteSettings } from '@/core/settings/schema';

import { EmailProviderKind } from './model';
import { readSecretInfos, SecretName, SecretState } from './secrets';

/** True when some form has a recipient list of its own or there are default recipients. */
export function hasRecipients(forms: SiteSettings['forms']): boolean {
  return (
    forms.defaultRecipients.length > 0 ||
    Object.values(forms.destinations).some(
      (destination) => destination.email.enabled && destination.email.recipients.length > 0,
    )
  );
}

export const NO_RECIPIENTS_WARNING =
  'Requests are saved but not emailed: add recipients in Settings → Requests.';

/** Plain-language problems with connected integrations (Security status card). */
export async function integrationProblems(db: Database): Promise<string[]> {
  const settings = await readSiteSettings(db);
  const { email } = settings.integrations;
  const problems: string[] = [];
  if (email.provider !== EmailProviderKind.None) {
    const secrets = await readSecretInfos(db);
    const secret =
      secrets[
        email.provider === EmailProviderKind.Resend
          ? SecretName.ResendApiKey
          : SecretName.SmtpPassword
      ];
    if (secret.state === SecretState.Unreadable) {
      problems.push(
        'The saved email credentials can’t be read any more. Enter them again in Settings → Integrations.',
      );
    } else if (email.lastCheck && !email.lastCheck.ok) {
      problems.push(
        `Email: the last test failed${email.lastCheck.error ? ` (${email.lastCheck.error})` : ''}. Check Settings → Integrations.`,
      );
    }
  }
  const mail = await resolveMailConfig(db);
  if (
    contentRegistry.forms.length > 0 &&
    mail.source !== MailSource.None &&
    mail.source !== MailSource.Dev &&
    !hasRecipients(settings.forms)
  ) {
    problems.push(NO_RECIPIENTS_WARNING);
  }
  return problems;
}
