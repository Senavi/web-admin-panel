import type { FormErrors, FormValues } from './validation';

/** Result of a submission, returned by `submitFormAction` to `useActionState` (client-safe). */
export const FormSubmitStatus = {
  Idle: 'idle',
  Success: 'success',
  /** Validation failed; `errors` holds one code per field. */
  Invalid: 'invalid',
  RateLimited: 'rate-limited',
  /** Unexpected error or failed Turnstile check. */
  Error: 'error',
  /**
   * The timing token was missing (no JavaScript: it streams in after the page).
   * The re-rendered form carries a fresh token; the visitor submits again.
   */
  Confirm: 'confirm',
} as const;
export type FormSubmitStatus = (typeof FormSubmitStatus)[keyof typeof FormSubmitStatus];

export interface FormSubmitState {
  readonly status: FormSubmitStatus;
  readonly errors?: FormErrors;
  /** Submitted values, so a re-rendered form (also without JavaScript) keeps them. */
  readonly values?: FormValues;
  /** Fresh timing token for the confirm step. */
  readonly token?: string;
}

export const INITIAL_FORM_STATE: FormSubmitState = { status: FormSubmitStatus.Idle };
