import 'server-only';

import { createHmac } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import nodemailer from 'nodemailer';

import { humanizeKey } from '@/core/content/fields';
import { MAIL_DIR } from '@/core/db/paths';
import { type DeliveryRecord, type DeliveryState, formSubmissions } from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { env, isProduction, MailProvider } from '@/core/env';
import type { FormDestinations } from '@/core/settings/schema';

import { type AnyForm, FormFieldType } from './define';

/**
 * Delivery of stored submissions to the destinations configured in Settings →
 * Forms. Each destination is independent: a failure is recorded on the
 * submission (shown in the inbox) and retried by the maintenance job. Secrets
 * come from env only; submission data is never logged.
 */

export const Destination = {
  Email: 'email',
  Webhook: 'webhook',
  Telegram: 'telegram',
} as const;
export type Destination = (typeof Destination)[keyof typeof Destination];

export const DeliveryStatus = {
  Pending: 'pending',
  Sent: 'sent',
  Failed: 'failed',
} as const;

/** Attempts per destination before the maintenance job gives up. */
export const MAX_DELIVERY_ATTEMPTS = 5;
const TIMEOUT_MS = 10_000;

export interface Submission {
  readonly id: string;
  readonly formId: string;
  readonly locale: string;
  readonly pagePath: string | null;
  readonly createdAt: Date;
  readonly data: Readonly<Record<string, string | boolean>>;
}

/** Destinations enabled for a form. */
export function enabledDestinations(destinations: FormDestinations | undefined): Destination[] {
  if (!destinations) return [];
  return (Object.values(Destination) as Destination[]).filter(
    (destination) => destinations[destination].enabled,
  );
}

interface Line {
  readonly label: string;
  readonly value: string;
}

function lines(form: AnyForm, submission: Submission): Line[] {
  return Object.entries(form.fields).map(([key, field]) => {
    const raw = submission.data[key];
    const value =
      field.type === FormFieldType.Checkbox || field.type === FormFieldType.Consent
        ? raw
          ? 'Yes'
          : 'No'
        : String(raw ?? '');
    return { label: field.label ?? humanizeKey(key), value };
  });
}

/** Plain-text body (no HTML, so submitted values can't inject markup). */
export function plainTextBody(form: AnyForm, submission: Submission): string {
  const header = [
    `New submission: ${form.label}`,
    `Page: ${submission.pagePath ?? '-'} (${submission.locale})`,
    `Received: ${submission.createdAt.toISOString()}`,
    `ID: ${submission.id}`,
  ];
  const body = lines(form, submission).map((line) => `${line.label}:\n${line.value || '-'}`);
  return [...header, '', ...body].join('\n');
}

/** The submitter's email, if the form has a valid one (used as Reply-To). */
function replyTo(form: AnyForm, submission: Submission): string | undefined {
  for (const [key, field] of Object.entries(form.fields)) {
    const value = submission.data[key];
    if (field.type === FormFieldType.Email && typeof value === 'string' && value) {
      return value.replace(/[\r\n]/g, '');
    }
  }
  return undefined;
}

function mailProvider(): MailProvider | null {
  return env().MAIL_PROVIDER ?? (isProduction() ? null : MailProvider.Dev);
}

async function sendEmail(
  form: AnyForm,
  submission: Submission,
  recipients: readonly string[],
): Promise<void> {
  const subject = `New submission: ${form.label}`.replace(/[\r\n]/g, ' ');
  const text = plainTextBody(form, submission);
  const reply = replyTo(form, submission);
  const from = env().MAIL_FROM ?? 'Website <forms@localhost>';
  switch (mailProvider()) {
    case MailProvider.Dev: {
      await fs.mkdir(MAIL_DIR, { recursive: true });
      const file = path.join(MAIL_DIR, `${submission.createdAt.getTime()}-${submission.id}.txt`);
      const headers = [
        `From: ${from}`,
        `To: ${recipients.join(', ')}`,
        ...(reply ? [`Reply-To: ${reply}`] : []),
        `Subject: ${subject}`,
      ];
      await fs.writeFile(file, `${headers.join('\n')}\n\n${text}\n`, 'utf8');
      return;
    }
    case MailProvider.Resend: {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env().RESEND_API_KEY ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: recipients, subject, text, reply_to: reply }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Resend responded ${response.status}`);
      return;
    }
    case MailProvider.Smtp: {
      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = env();
      const port = SMTP_PORT ?? 587;
      const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        ...(SMTP_USER ? { auth: { user: SMTP_USER, pass: SMTP_PASSWORD ?? '' } } : {}),
        connectionTimeout: TIMEOUT_MS,
      });
      await transport.sendMail({ from, to: [...recipients], subject, text, replyTo: reply });
      return;
    }
    case null:
      throw new Error('Email is not configured (set MAIL_PROVIDER).');
  }
}

/** `sha256=<hex>` HMAC of the raw body (verify with FORMS_WEBHOOK_SECRET). */
export function webhookSignature(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

export const WEBHOOK_SIGNATURE_HEADER = 'X-Signature';

async function sendWebhook(form: AnyForm, submission: Submission, url: string): Promise<void> {
  const secret = env().FORMS_WEBHOOK_SECRET;
  if (!secret) throw new Error('FORMS_WEBHOOK_SECRET is not set.');
  const body = JSON.stringify({
    id: submission.id,
    form: form.id,
    locale: submission.locale,
    page: submission.pagePath,
    createdAt: submission.createdAt.toISOString(),
    data: submission.data,
  });
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [WEBHOOK_SIGNATURE_HEADER]: webhookSignature(secret, body),
      'X-Submission-Id': submission.id,
    },
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Webhook responded ${response.status}`);
}

/** Telegram limits messages to 4096 characters. */
const TELEGRAM_MAX = 4000;

async function sendTelegram(form: AnyForm, submission: Submission, chatId: string): Promise<void> {
  const token = env().TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set.');
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: plainTextBody(form, submission).slice(0, TELEGRAM_MAX),
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Telegram responded ${response.status}`);
}

function send(
  destination: Destination,
  form: AnyForm,
  submission: Submission,
  config: FormDestinations,
): Promise<void> {
  switch (destination) {
    case Destination.Email:
      return sendEmail(form, submission, config.email.recipients);
    case Destination.Webhook:
      return sendWebhook(form, submission, config.webhook.url);
    case Destination.Telegram:
      return sendTelegram(form, submission, config.telegram.chatId);
  }
}

/** Short reason for the inbox; never contains submission data or secrets. */
function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Delivery failed';
  return message.replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, 'bot***').slice(0, 200);
}

/**
 * Delivers to `destinations` (all enabled ones, or only previously failed ones
 * on retry) and stores the per-destination result. Returns the new state.
 */
export async function deliverSubmission(
  db: Database,
  form: AnyForm,
  submission: Submission,
  config: FormDestinations,
  destinations: readonly Destination[],
  previous: DeliveryState = {},
): Promise<DeliveryState> {
  const results = await Promise.all(
    destinations.map(async (destination): Promise<[Destination, DeliveryRecord]> => {
      const attempts = (previous[destination]?.attempts ?? 0) + 1;
      const at = new Date().toISOString();
      try {
        await send(destination, form, submission, config);
        return [destination, { status: DeliveryStatus.Sent, attempts, at }];
      } catch (error) {
        return [
          destination,
          { status: DeliveryStatus.Failed, attempts, at, error: reasonOf(error) },
        ];
      }
    }),
  );
  const next: DeliveryState = { ...previous, ...Object.fromEntries(results) };
  await db
    .update(formSubmissions)
    .set({ delivery: next })
    .where(eq(formSubmissions.id, submission.id));
  return next;
}
