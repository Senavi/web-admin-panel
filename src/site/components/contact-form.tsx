'use client';

/**
 * PROJECT: visual layer of a site form. The core engine (`useSiteForm`) does
 * validation, accessibility wiring, submission and spam protection; this
 * component only renders it with the site's primitives and design tokens.
 */
import { type ReactNode, useRef } from 'react';

import type { SiteFormConfig } from '@/core/forms/config';
import { FormFieldType } from '@/core/forms/define';
import {
  type FormMessages,
  type SiteFormFieldProps,
  useSiteForm,
} from '@/core/forms/use-site-form';

import { buttonClasses } from './ui/button-styles';
import { cx } from './ui/cn';
import { Heading, Text } from './ui/typography';

export interface ContactFormStrings {
  readonly summaryTitle: string;
  readonly required: string;
  readonly sending: string;
  readonly choose: string;
}

const CONTROL =
  'text-body w-full rounded-md border-thin border-border bg-background px-4 py-2 text-foreground';
const CONTROL_INVALID = 'border-danger';

export function ContactForm({
  config,
  messages,
  strings,
  security,
  consentTexts,
}: {
  config: SiteFormConfig;
  messages: FormMessages;
  strings: ContactFormStrings;
  /** `<FormSecurityFields>` rendered on the server. */
  security: ReactNode;
  /** Consent texts (rich text) rendered on the server, by field name. */
  consentTexts: Readonly<Record<string, ReactNode>>;
}) {
  const summaryRef = useRef<HTMLDivElement>(null);
  const form = useSiteForm({ config, messages, summaryRef });

  if (form.succeeded) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-lg bg-surface p-6">
        <Heading level={2} variant="h4">
          {config.successTitle}
        </Heading>
        <Text>{config.successMessage}</Text>
      </div>
    );
  }

  return (
    <form {...form.formProps} className="flex flex-col gap-6" aria-busy={form.pending || undefined}>
      {form.hiddenFields}
      {security}

      {form.summary.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="flex flex-col gap-2 rounded-md border-thick border-danger p-4"
        >
          <Text variant="label">{strings.summaryTitle}</Text>
          <ul className="flex flex-col gap-1">
            {form.summary.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="text-body-sm text-danger underline">
                  {item.label}: {item.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {form.notice ? (
        <Text role="alert" tone={form.notice.kind === 'error' ? 'danger' : 'primary'}>
          {form.notice.text}
        </Text>
      ) : null}

      {config.fields.map((item) => (
        <Field
          key={item.name}
          props={form.field(item.name)}
          strings={strings}
          consentText={consentTexts[item.name]}
        />
      ))}

      <div>
        <button type="submit" className={buttonClasses('primary')} disabled={form.pending}>
          {form.pending ? strings.sending : config.submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  props,
  strings,
  consentText,
}: {
  props: SiteFormFieldProps;
  strings: ContactFormStrings;
  consentText: ReactNode;
}) {
  const { field, ids, inputProps, error } = props;
  const { type, required } = field.definition;
  const help = field.help ? (
    <Text id={ids.help} variant="caption" tone="muted">
      {field.help}
    </Text>
  ) : null;
  // One line is always reserved, so inline validation never shifts the layout under the pointer.
  const errorText = (
    <Text id={ids.error} variant="caption" tone="danger" className="min-h-5">
      {error ?? ''}
    </Text>
  );

  if (type === FormFieldType.Checkbox || type === FormFieldType.Consent) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-3">
          <input {...inputProps} className="mt-1 size-5 accent-primary" />
          <label htmlFor={ids.input} className="text-body-sm">
            {consentText ?? field.label}
            {required ? <span className="sr-only"> ({strings.required})</span> : null}
          </label>
        </div>
        {help}
        {errorText}
      </div>
    );
  }

  const label = (
    <label htmlFor={ids.input} className="text-label">
      {field.label}
      {required ? (
        <span className="text-danger" aria-hidden="true">
          {' '}
          *
        </span>
      ) : null}
      {required ? <span className="sr-only"> ({strings.required})</span> : null}
    </label>
  );

  return (
    <div className="flex flex-col gap-2">
      {label}
      {type === FormFieldType.Textarea ? (
        <textarea
          {...inputProps}
          placeholder={field.placeholder}
          rows={6}
          className={cx(CONTROL, error && CONTROL_INVALID)}
        />
      ) : type === FormFieldType.Select ? (
        <select {...inputProps} className={cx(CONTROL, 'min-h-11', error && CONTROL_INVALID)}>
          <option value="">{strings.choose}</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...inputProps}
          placeholder={field.placeholder}
          className={cx(CONTROL, 'min-h-11')}
        />
      )}
      {help}
      {errorText}
    </div>
  );
}
