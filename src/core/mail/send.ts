import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';

import nodemailer from 'nodemailer';

import { MAIL_DIR } from '@/core/db/paths';
import { MailProvider } from '@/core/env';
import { SmtpSecurity } from '@/core/integrations/model';

import { type MailConfig, MailSource } from './config';

const TIMEOUT_MS = 10_000;

export interface MailMessage {
  readonly to: readonly string[];
  readonly subject: string;
  readonly text: string;
  readonly replyTo?: string;
  /** Names the file in development (`<id>.txt`). */
  readonly id: string;
  readonly createdAt: Date;
}

/** Email cannot be sent at all (no provider, or a stored credential cannot be read). */
export class MailNotConfiguredError extends Error {}

/** Sends one plain-text email. Throws with a short reason; never includes secrets. */
export async function sendMail(config: MailConfig, message: MailMessage): Promise<void> {
  const subject = message.subject.replace(/[\r\n]/g, ' ');
  if (config.source === MailSource.None) {
    throw new MailNotConfiguredError(
      'Email is not connected. Add a provider in Settings → Integrations.',
    );
  }
  if (config.source === MailSource.Dev) {
    await fs.mkdir(MAIL_DIR, { recursive: true });
    const file = path.join(MAIL_DIR, `${message.createdAt.getTime()}-${message.id}.txt`);
    const headers = [
      `From: ${config.from}`,
      `To: ${message.to.join(', ')}`,
      ...(message.replyTo ? [`Reply-To: ${message.replyTo}`] : []),
      `Subject: ${subject}`,
    ];
    await fs.writeFile(file, `${headers.join('\n')}\n\n${message.text}\n`, 'utf8');
    return;
  }
  if (config.provider === MailProvider.Resend) {
    if (!config.apiKey) {
      throw new MailNotConfiguredError(
        'The Resend API key is missing or unreadable. Enter it again in Settings → Integrations.',
      );
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: config.from,
        to: message.to,
        subject,
        text: message.text,
        reply_to: message.replyTo,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Resend responded ${response.status}`);
    return;
  }
  if (config.password === null) {
    throw new MailNotConfiguredError(
      'The SMTP password is unreadable. Enter it again in Settings → Integrations.',
    );
  }
  if (!config.host) throw new MailNotConfiguredError('The SMTP server is not set.');
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.security === SmtpSecurity.Ssl,
    requireTLS: config.security === SmtpSecurity.StartTls,
    ignoreTLS: config.security === SmtpSecurity.None,
    ...(config.user ? { auth: { user: config.user, pass: config.password } } : {}),
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
  try {
    await transport.sendMail({
      from: config.from,
      to: [...message.to],
      subject,
      text: message.text,
      replyTo: message.replyTo,
    });
  } finally {
    transport.close();
  }
}
