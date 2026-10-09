import type { FormSubmitState } from './state';

/** Public form endpoints (client-safe constants). */
export const FORM_SUBMIT_PATH = '/api/forms/submit';
export const FORM_TOKEN_PATH = '/api/forms/token';

/** Accept header of script submissions: the endpoint answers with JSON instead of HTML. */
export const JSON_ACCEPT = 'application/json';

/** JSON answer of `/api/forms/submit` to script submissions. */
export interface FormSubmitResponse {
  readonly state: FormSubmitState;
  /** Thank-you page to open after a success. */
  readonly redirectTo?: string;
}
