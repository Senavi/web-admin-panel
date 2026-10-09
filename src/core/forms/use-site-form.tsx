'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  type FormEvent,
  type FocusEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import type { SiteFormConfig, SiteFormField } from './config';
import { type FormFieldDefinition, FormFieldType } from './define';
import { FormHiddenField } from './fields';
import { FORM_SUBMIT_PATH, FORM_TOKEN_PATH, type FormSubmitResponse, JSON_ACCEPT } from './paths';
import { type FormSubmitState, FormSubmitStatus, INITIAL_FORM_STATE } from './state';
import {
  DEFAULT_ERROR_MESSAGES,
  type FormErrorCode,
  type FormErrors,
  validateSubmission,
  valuesFromFormData,
} from './validation';

/**
 * Headless, accessible form engine for the public site. It renders no
 * markup of its own beyond hidden inputs: the project builds the form with its
 * own primitives and design tokens. Before hydration (and without JavaScript)
 * the form posts to `/api/forms/submit` with native browser validation; once
 * hydrated it submits the same endpoint with `fetch` (JSON answer): inline
 * validation, an error summary that receives focus, a pending state, no page
 * reload. (Server actions are not used on public pages: they re-render
 * prerendered pages and reset the form, see docs/DECISIONS.md D-069.)
 *
 *  *   const form = useSiteForm({ config, messages, summaryRef });
 *   <form {...form.formProps}>{form.hiddenFields}{security}…</form>
 *   (render the error summary with `ref={summaryRef} tabIndex={-1}`)
 */

export type FormMessages = Partial<
  Record<FormErrorCode | 'rateLimited' | 'error' | 'confirm', string>
>;

export interface SiteFormFieldProps {
  readonly field: SiteFormField;
  readonly ids: { readonly input: string; readonly error: string; readonly help: string };
  /** Spread on the <input>/<textarea>/<select>. */
  readonly inputProps: {
    readonly id: string;
    readonly name: string;
    readonly required: boolean;
    readonly maxLength?: number;
    readonly 'aria-invalid'?: true;
    readonly 'aria-describedby'?: string;
    readonly onBlur: (
      event: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => void;
    readonly defaultValue?: string;
    readonly defaultChecked?: boolean;
    readonly type?: string;
    readonly autoComplete?: string;
  };
  /** Localized error message, or null. */
  readonly error: string | null;
}

export interface SiteFormSummaryItem {
  readonly href: string;
  readonly label: string;
  readonly message: string;
}

const INPUT_TYPE: Partial<Record<FormFieldType, string>> = {
  [FormFieldType.Text]: 'text',
  [FormFieldType.Email]: 'email',
  [FormFieldType.Tel]: 'tel',
  [FormFieldType.Checkbox]: 'checkbox',
  [FormFieldType.Consent]: 'checkbox',
};

const AUTOCOMPLETE: Partial<Record<FormFieldType, string>> = {
  [FormFieldType.Email]: 'email',
  [FormFieldType.Tel]: 'tel',
};

function isBoolean(definition: FormFieldDefinition): boolean {
  return definition.type === FormFieldType.Checkbox || definition.type === FormFieldType.Consent;
}

export function useSiteForm({
  config,
  messages = {},
  summaryRef,
}: {
  config: SiteFormConfig;
  messages?: FormMessages;
  /** Error summary element; receives focus when validation fails. */
  summaryRef: RefObject<HTMLElement | null>;
}) {
  const [state, setState] = useState<FormSubmitState>(INITIAL_FORM_STATE);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const [clientToken, setClientToken] = useState<string | null>(null);

  // Minimum fill time starts when the form is usable: ask for a signed token once hydrated.
  useEffect(() => {
    let active = true;
    void fetch(`${FORM_TOKEN_PATH}?form=${encodeURIComponent(config.formId)}`, {
      cache: 'no-store',
    })
      .then((response) => response.json() as Promise<{ token: string | null }>)
      .then((body) => {
        if (active) setClientToken(body.token);
      })
      .catch(() => undefined); // without a token the server asks for a confirmation
    return () => {
      active = false;
    };
  }, [config.formId]);
  const token = state.token ?? clientToken;
  const [clientErrors, setClientErrors] = useState<FormErrors | null>(null);
  /** Errors of the last submit attempt: the summary only changes on submit (no layout shift while typing). */
  const [submitErrors, setSubmitErrors] = useState<FormErrors>({});
  const definitions = useMemo(
    () => ({
      fields: Object.fromEntries(config.fields.map((field) => [field.name, field.definition])),
    }),
    [config.fields],
  );
  const errors: FormErrors = clientErrors ?? state.errors ?? {};
  const message = (code: FormErrorCode) => messages[code] ?? DEFAULT_ERROR_MESSAGES[code];
  const idFor = (name: string) => `${config.formId}-${name}`;

  // Server-side validation errors (with JavaScript): move focus to the summary.
  useEffect(() => {
    if (state.status === FormSubmitStatus.Invalid) summaryRef.current?.focus();
  }, [state, summaryRef]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const values = valuesFromFormData(definitions, data);
    const result = validateSubmission(definitions, values);
    if (!result.ok) {
      setClientErrors(result.errors);
      setSubmitErrors(result.errors);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setClientErrors(null);
    setSubmitErrors({});
    setPending(true);
    fetch(FORM_SUBMIT_PATH, { method: 'POST', body: data, headers: { accept: JSON_ACCEPT } })
      .then((response) => response.json() as Promise<FormSubmitResponse>)
      .then((body) => {
        if (body.redirectTo) router.push(body.redirectTo);
        setState(body.state);
        setSubmitErrors(body.state.errors ?? {});
      })
      .catch(() => setState({ status: FormSubmitStatus.Error, values }))
      .finally(() => setPending(false));
  };

  const validateOne = (name: string, form: HTMLFormElement | null) => {
    if (!form || clientErrors === null) return; // inline checks start after the first submit
    const result = validateSubmission(
      definitions,
      valuesFromFormData(definitions, new FormData(form)),
    );
    setClientErrors((current) => {
      const next: FormErrors = { ...(current ?? {}) };
      const code = result.ok ? undefined : result.errors[name];
      if (code) next[name] = code;
      else delete next[name];
      return next;
    });
  };

  const field = (name: string): SiteFormFieldProps => {
    const definition = config.fields.find((candidate) => candidate.name === name);
    if (!definition) throw new Error(`Form "${config.formId}" has no field "${name}".`);
    const ids = { input: idFor(name), error: `${idFor(name)}-error`, help: `${idFor(name)}-help` };
    const code = errors[name];
    const described = [code ? ids.error : null, definition.help ? ids.help : null]
      .filter(Boolean)
      .join(' ');
    const previous = state.values?.[name];
    return {
      field: definition,
      ids,
      error: code ? message(code) : null,
      inputProps: {
        id: ids.input,
        name,
        required: Boolean(definition.definition.required),
        ...(definition.definition.max ? { maxLength: definition.definition.max } : {}),
        ...(code ? { 'aria-invalid': true as const } : {}),
        ...(described ? { 'aria-describedby': described } : {}),
        onBlur: (event) => validateOne(name, event.currentTarget.form),
        ...(INPUT_TYPE[definition.definition.type]
          ? { type: INPUT_TYPE[definition.definition.type] }
          : {}),
        ...(AUTOCOMPLETE[definition.definition.type]
          ? { autoComplete: AUTOCOMPLETE[definition.definition.type] }
          : {}),
        ...(isBoolean(definition.definition)
          ? { defaultChecked: previous === true }
          : { defaultValue: typeof previous === 'string' ? previous : '' }),
      },
    };
  };

  const summary: SiteFormSummaryItem[] = config.fields.flatMap((item) => {
    const code = submitErrors[item.name];
    return code
      ? [{ href: `#${idFor(item.name)}`, label: item.label || item.name, message: message(code) }]
      : [];
  });

  const hiddenFields: ReactNode = (
    <>
      <input type="hidden" name={FormHiddenField.Form} value={config.formId} />
      <input type="hidden" name={FormHiddenField.Locale} value={config.locale} />
      <input type="hidden" name={FormHiddenField.Page} value={pathname} />
      {token ? <input type="hidden" name={FormHiddenField.Token} value={token} /> : null}
    </>
  );

  return {
    // Server HTML: native POST + browser validation. Hydrated: server action + our validation.
    formProps: hydrated
      ? {
          id: `form-${config.formId}`,
          action: FORM_SUBMIT_PATH,
          method: 'post',
          onSubmit,
          noValidate: true,
        }
      : { id: `form-${config.formId}`, action: FORM_SUBMIT_PATH, method: 'post' },
    hiddenFields,
    field,
    /** Errors to list in the summary (`summaryRef`, tabIndex={-1}). */
    summary,
    pending,
    status: state.status,
    succeeded: state.status === FormSubmitStatus.Success,
    /** Form-level message (rate limit, error, confirm step), localized. */
    notice: noticeFor(state.status, messages),
  };
}

function subscribeNever(): () => void {
  return () => undefined;
}

export interface FormNotice {
  readonly text: string;
  /** `info` for the confirm step, `error` otherwise. */
  readonly kind: 'info' | 'error';
}

function noticeFor(status: FormSubmitState['status'], messages: FormMessages): FormNotice | null {
  switch (status) {
    case FormSubmitStatus.RateLimited:
      return {
        kind: 'error',
        text: messages.rateLimited ?? 'Too many submissions. Please try again later.',
      };
    case FormSubmitStatus.Error:
      return { kind: 'error', text: messages.error ?? 'Something went wrong. Please try again.' };
    case FormSubmitStatus.Confirm:
      return {
        kind: 'info',
        text:
          messages.confirm ?? 'Please check your message and press the button again to send it.',
      };
    case FormSubmitStatus.Idle:
    case FormSubmitStatus.Success:
    case FormSubmitStatus.Invalid:
      return null;
  }
}
