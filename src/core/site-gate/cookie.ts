import 'server-only';

import { cookies } from 'next/headers';

import { getAuthSecret } from '@/core/auth/secret';
import type { Role } from '@/core/auth/roles';
import { isProduction } from '@/core/env';

import { GATE_COOKIE_NAME, GATE_TOKEN_TTL_SECONDS, signGateToken } from './token';

export interface GateSubject {
  readonly id: string;
  readonly role: Role;
  readonly sessionVersion: number;
}

/** Issues the signed site-gate cookie (server actions / route handlers only). */
export async function issueGateCookie(subject: GateSubject): Promise<void> {
  const token = await signGateToken(getAuthSecret(), {
    uid: subject.id,
    role: subject.role,
    v: subject.sessionVersion,
    exp: Math.floor(Date.now() / 1000) + GATE_TOKEN_TTL_SECONDS,
  });
  (await cookies()).set(GATE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: GATE_TOKEN_TTL_SECONDS,
  });
}

export async function clearGateCookie(): Promise<void> {
  (await cookies()).delete(GATE_COOKIE_NAME);
}
