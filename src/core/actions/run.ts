import 'server-only';

import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';

import { PasswordPolicyError } from '@/core/auth/server/users';
import { AuthorizationError } from '@/core/auth/server/session';

import { ActionErrorCode, fail, type ActionResult } from './result';

/** Expected business-rule failure with a user-facing message (e.g. "You cannot disable yourself"). */
export class GuardError extends Error {
  constructor(
    message: string,
    readonly code: ActionErrorCode = ActionErrorCode.Guard,
  ) {
    super(message);
    this.name = 'GuardError';
  }
}

/**
 * Wraps a server action body: maps known errors to `ActionResult` failures,
 * lets Next.js control-flow errors (redirect/notFound) through, and logs the rest
 * without leaking internals to the client.
 */
export async function runAction<T>(body: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await body();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthorizationError)
      return fail(error.message, ActionErrorCode.Unauthorized);
    if (error instanceof GuardError) return fail(error.message, error.code);
    if (error instanceof PasswordPolicyError) {
      return fail(error.message, ActionErrorCode.Validation, { password: [error.message] });
    }
    if (error instanceof z.ZodError) {
      return fail(
        'Please fix the highlighted fields.',
        ActionErrorCode.Validation,
        zodFieldErrors(error),
      );
    }
    console.error('[action] unexpected error', error);
    return fail('Something went wrong. Please try again.');
  }
}

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    (result[key] ??= []).push(issue.message);
  }
  return result;
}
