import { z } from 'zod';

import { EMAIL, PHONE } from '@/core/content/validation';

import {
  type AnyForm,
  DEFAULT_TEXT_MAX,
  DEFAULT_TEXTAREA_MAX,
  type FormFieldDefinition,
  FormFieldType,
} from './define';

/**
 * Submission validation derived from a form definition. Messages are error
 * codes; the site maps them to localized UI strings (`src/site/messages`,
 * `forms.errors.*`) with English defaults (`DEFAULT_ERROR_MESSAGES`).
 * Shared by the browser (inline validation) and the server action.
 */

export const FormErrorCode = {
  Required: 'required',
  TooLong: 'tooLong',
  InvalidEmail: 'invalidEmail',
  InvalidPhone: 'invalidPhone',
  InvalidOption: 'invalidOption',
  Consent: 'consent',
} as const;
export type FormErrorCode = (typeof FormErrorCode)[keyof typeof FormErrorCode];

export const DEFAULT_ERROR_MESSAGES: Record<FormErrorCode, string> = {
  [FormErrorCode.Required]: 'This field is required.',
  [FormErrorCode.TooLong]: 'This is too long.',
  [FormErrorCode.InvalidEmail]: 'Enter a valid email address.',
  [FormErrorCode.InvalidPhone]: 'Enter a valid phone number.',
  [FormErrorCode.InvalidOption]: 'Choose one of the options.',
  [FormErrorCode.Consent]: 'Please confirm to continue.',
};

export type FormValue = string | boolean;
export type FormValues = Record<string, FormValue>;
export type FormErrors = Partial<Record<string, FormErrorCode>>;

function maxOf(field: FormFieldDefinition): number {
  return (
    field.max ?? (field.type === FormFieldType.Textarea ? DEFAULT_TEXTAREA_MAX : DEFAULT_TEXT_MAX)
  );
}

function stringSchema(field: FormFieldDefinition, pattern?: { re: RegExp; code: FormErrorCode }) {
  return z
    .string()
    .trim()
    .max(maxOf(field), FormErrorCode.TooLong)
    .refine((value) => value !== '' || !field.required, FormErrorCode.Required)
    .refine((value) => value === '' || !pattern || pattern.re.test(value), pattern?.code ?? '');
}

export function fieldValueSchema(field: FormFieldDefinition): z.ZodType<FormValue> {
  switch (field.type) {
    case FormFieldType.Text:
    case FormFieldType.Textarea:
      return stringSchema(field);
    case FormFieldType.Email:
      return stringSchema(field, { re: EMAIL, code: FormErrorCode.InvalidEmail });
    case FormFieldType.Tel:
      return stringSchema(field, { re: PHONE, code: FormErrorCode.InvalidPhone });
    case FormFieldType.Select:
      return z
        .string()
        .refine((value) => value !== '' || !field.required, FormErrorCode.Required)
        .refine(
          (value) => value === '' || (field.options ?? []).includes(value),
          FormErrorCode.InvalidOption,
        );
    case FormFieldType.Checkbox:
      return z.boolean();
    case FormFieldType.Consent:
      return z.boolean().refine((value) => value || !field.required, FormErrorCode.Consent);
  }
}

/** Reads a form's fields from FormData (checkboxes: present = true). Unknown keys are ignored. */
export function valuesFromFormData(form: Pick<AnyForm, 'fields'>, data: FormData): FormValues {
  const values: FormValues = {};
  for (const [key, field] of Object.entries(form.fields)) {
    const raw = data.get(key);
    values[key] =
      field.type === FormFieldType.Checkbox || field.type === FormFieldType.Consent
        ? raw !== null && raw !== ''
        : typeof raw === 'string'
          ? raw
          : '';
  }
  return values;
}

/** Validates values; returns cleaned values or one error code per invalid field. */
export function validateSubmission(
  form: Pick<AnyForm, 'fields'>,
  values: FormValues,
): { ok: true; values: FormValues } | { ok: false; errors: FormErrors } {
  const clean: FormValues = {};
  const errors: FormErrors = {};
  for (const [key, field] of Object.entries(form.fields)) {
    const result = fieldValueSchema(field).safeParse(values[key]);
    if (result.success) clean[key] = result.data;
    else
      errors[key] =
        (result.error.issues[0]?.message as FormErrorCode | undefined) ?? FormErrorCode.Required;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, values: clean };
}
