import 'server-only';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins/two-factor';

import { projectConfig } from '@project/config';

import * as schema from '@/core/db/schema';
import type { Database } from '@/core/db/types';
import { env, isProduction } from '@/core/env';
import { readSiteSettings } from '@/core/settings/repository';

import { AUTH_COOKIE_PREFIX } from '../cookies';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../password-policy';
import { Role, UserStatus } from '../roles';
import { getAuthSecret } from '../secret';
import { findUserById } from './users';

export const AUTH_BASE_PATH = '/api/auth';
const DAY_SECONDS = 60 * 60 * 24;

/**
 * Better Auth configuration. All sign-in / password / 2FA mutations go through
 * our server actions (which add throttling, audit logging and the site-gate
 * cookie); only a small allowlist of endpoints is reachable over HTTP
 * (see `src/app/api/auth/[...all]/route.ts`).
 */
export function createAuth(db: Database) {
  const siteUrl = env().NEXT_PUBLIC_SITE_URL;

  return betterAuth({
    appName: projectConfig.name,
    secret: getAuthSecret(),
    basePath: AUTH_BASE_PATH,
    baseURL: isProduction()
      ? siteUrl
      : {
          allowedHosts: ['localhost:*', '127.0.0.1:*', ...(siteUrl ? [new URL(siteUrl).host] : [])],
          fallback: siteUrl ?? 'http://localhost:3000',
          protocol: 'http',
        },
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        twoFactor: schema.twoFactors,
        rateLimit: schema.rateLimits,
      },
    }),
    advanced: {
      useSecureCookies: isProduction(),
      cookiePrefix: AUTH_COOKIE_PREFIX,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: isProduction() },
      database: { generateId: () => crypto.randomUUID() },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
    },
    session: {
      // Overridden per session from Settings → Security policy (see databaseHooks).
      expiresIn: 7 * DAY_SECONDS,
      updateAge: DAY_SECONDS,
    },
    user: {
      additionalFields: {
        role: { type: 'string', required: true, defaultValue: Role.Manager, input: false },
        status: { type: 'string', required: true, defaultValue: UserStatus.Active, input: false },
        mustChangePassword: { type: 'boolean', required: true, defaultValue: false, input: false },
        lastLoginAt: { type: 'date', required: false, input: false },
        sessionVersion: { type: 'number', required: true, defaultValue: 0, input: false },
      },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
    },
    databaseHooks: {
      session: {
        create: {
          // Disabled users can never obtain a session; lifetime follows the security policy.
          before: async (session) => {
            const user = await findUserById(db, session.userId);
            if (!user || user.status !== UserStatus.Active) return false;
            const { security } = await readSiteSettings(db);
            const expiresAt = new Date(
              Date.now() + security.sessionLifetimeDays * DAY_SECONDS * 1000,
            );
            return { data: { ...session, expiresAt } };
          },
        },
      },
    },
    plugins: [twoFactor({ issuer: projectConfig.name }), nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
