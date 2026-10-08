/**
 * Uniform result type returned by every server action, so forms can show
 * toasts and map validation errors to fields without try/catch.
 */
export type FieldErrors = Record<string, string[]>;

export type ActionResult<T = undefined> =
  | { readonly ok: true; readonly data: T; readonly message?: string }
  | {
      readonly ok: false;
      readonly error: string;
      readonly code?: ActionErrorCode;
      readonly fieldErrors?: FieldErrors;
    };

export const ActionErrorCode = {
  Unauthorized: 'unauthorized',
  Validation: 'validation',
  Conflict: 'conflict',
  RateLimited: 'rate_limited',
  NotFound: 'not_found',
  Guard: 'guard',
  Internal: 'internal',
} as const;
export type ActionErrorCode = (typeof ActionErrorCode)[keyof typeof ActionErrorCode];

export function ok(): ActionResult;
export function ok<T>(data: T, message?: string): ActionResult<T>;
export function ok<T>(data?: T, message?: string): ActionResult<T | undefined> {
  return { ok: true, data, message };
}

export function fail(
  error: string,
  code: ActionErrorCode = ActionErrorCode.Internal,
  fieldErrors?: FieldErrors,
): { ok: false; error: string; code: ActionErrorCode; fieldErrors?: FieldErrors } {
  return fieldErrors ? { ok: false, error, code, fieldErrors } : { ok: false, error, code };
}
