import { z } from 'zod';

/**
 * Environment variable schema. Kept free of `server-only` so scripts and unit
 * tests can import it; runtime code reads env through `@/core/env`.
 * Every variable is documented in `.env.example`.
 */

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

const optionalUrl = optionalString.pipe(z.url().optional());

export const StorageDriver = {
  Local: 'local',
  Supabase: 'supabase',
} as const;
export type StorageDriver = (typeof StorageDriver)[keyof typeof StorageDriver];

/** How form emails are sent. `dev` writes them to `<data dir>/mail/` (development, CI). */
export const MailProvider = {
  Dev: 'dev',
  Resend: 'resend',
  Smtp: 'smtp',
} as const;
export type MailProvider = (typeof MailProvider)[keyof typeof MailProvider];

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    /** Public origin of the site, e.g. https://example.com. Required in production. */
    NEXT_PUBLIC_SITE_URL: optionalUrl,

    /** Pooled Postgres URL (Supabase transaction pooler). Unset → local PGlite in development. */
    DATABASE_URL: optionalUrl,
    /** Direct Postgres URL used for migrations. Falls back to DATABASE_URL. */
    DIRECT_URL: optionalUrl,

    /** Secret used to sign sessions and the site-gate cookie. Min 32 chars. */
    AUTH_SECRET: optionalString.pipe(z.string().min(32).optional()),

    STORAGE_DRIVER: z.enum([StorageDriver.Local, StorageDriver.Supabase]).optional(),
    /** Explicitly allow the local filesystem storage driver in production (CI / self-hosting). */
    ALLOW_LOCAL_STORAGE_IN_PRODUCTION: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SUPABASE_URL: optionalUrl,
    SUPABASE_ANON_KEY: optionalString,
    SUPABASE_SERVICE_ROLE_KEY: optionalString,
    SUPABASE_STORAGE_BUCKET: optionalString.default('media'),

    /** Protects /api/cron/maintenance. Cron endpoint is disabled when unset. */
    CRON_SECRET: optionalString.pipe(z.string().min(16).optional()),

    /** Form email delivery: dev (files), resend or smtp. Default: dev outside production. */
    MAIL_PROVIDER: z.enum([MailProvider.Dev, MailProvider.Resend, MailProvider.Smtp]).optional(),
    /** Sender of form emails, e.g. `Website <forms@example.com>`. */
    MAIL_FROM: optionalString,
    RESEND_API_KEY: optionalString,
    SMTP_HOST: optionalString,
    SMTP_PORT: optionalString.pipe(
      z
        .string()
        .regex(/^[0-9]{1,5}$/)
        .transform(Number)
        .optional(),
    ),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    /** Signs form webhook requests (`X-Signature: sha256=…`). Min 16 chars. */
    FORMS_WEBHOOK_SECRET: optionalString.pipe(z.string().min(16).optional()),
    /** Telegram bot token for form notifications (chat id is set in Settings → Forms). */
    TELEGRAM_BOT_TOKEN: optionalString,
    /** Cloudflare Turnstile secret (with projectConfig.forms.turnstile.siteKey). */
    TURNSTILE_SECRET_KEY: optionalString,

    /** Development/test only: alternative local data directory (default `.data`). */
    SITE_DATA_DIR: optionalString,

    /** Development only: creates this admin on first run. Ignored in production. */
    SEED_ADMIN_EMAIL: optionalString.pipe(z.email().optional()),
    SEED_ADMIN_PASSWORD: optionalString,
  })
  .superRefine((env, ctx) => {
    const isProduction = env.NODE_ENV === 'production';

    if (isProduction && !env.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message:
          'DATABASE_URL is required in production. The embedded PGlite database only runs in development.',
      });
    }
    if (isProduction && !env.AUTH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_SECRET'],
        message: 'AUTH_SECRET (min 32 chars) is required in production.',
      });
    }
    if (isProduction && !env.NEXT_PUBLIC_SITE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SITE_URL'],
        message: 'NEXT_PUBLIC_SITE_URL is required in production (used for canonical URLs).',
      });
    }

    const driver = resolveStorageDriver(env);
    if (driver === StorageDriver.Supabase) {
      for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when the Supabase storage driver is used.`,
          });
        }
      }
    }
    const mailRequirements: Record<string, ReadonlyArray<keyof typeof env>> = {
      [MailProvider.Resend]: ['RESEND_API_KEY', 'MAIL_FROM'],
      [MailProvider.Smtp]: ['SMTP_HOST', 'MAIL_FROM'],
    };
    for (const key of mailRequirements[env.MAIL_PROVIDER ?? ''] ?? []) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when MAIL_PROVIDER=${env.MAIL_PROVIDER}.`,
        });
      }
    }
    if (isProduction && driver === StorageDriver.Local && !env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION) {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_DRIVER'],
        message:
          'Local file storage is not persistent on serverless platforms. Configure Supabase storage or set ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true.',
      });
    }
  });

export type EnvInput = z.input<typeof envSchema>;
export type Env = z.output<typeof envSchema>;

/** Storage driver: explicit setting, otherwise Supabase when configured, otherwise local. */
export function resolveStorageDriver(
  env: Pick<Env, 'STORAGE_DRIVER' | 'SUPABASE_URL'>,
): StorageDriver {
  if (env.STORAGE_DRIVER) return env.STORAGE_DRIVER;
  return env.SUPABASE_URL ? StorageDriver.Supabase : StorageDriver.Local;
}

export function formatEnvError(error: z.ZodError): string {
  const lines = error.issues.map(
    (issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`,
  );
  return `Invalid environment configuration:\n${lines.join('\n')}\nSee .env.example for documentation.`;
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }
  return result.data;
}
