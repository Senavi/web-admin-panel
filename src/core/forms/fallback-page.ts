import 'server-only';

import type { SiteFormConfig } from './config';
import { FormFieldType } from './define';
import { FormHiddenField } from './fields';
import { type FormSubmitState, FormSubmitStatus } from './state';
import { DEFAULT_ERROR_MESSAGES } from './validation';

/**
 * Minimal pages for browsers without JavaScript (`/api/forms/submit`): confirm
 * step, validation errors, success, rate limit. Visitors with JavaScript never
 * see them (the form submits through the server action and updates inline).
 * Every value is HTML-escaped.
 */

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

const STYLE =
  'body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;color:#111;background:#fff}' +
  'button{font:inherit;padding:.6rem 1.4rem;border-radius:999px;border:0;background:#111;color:#fff;cursor:pointer}' +
  'li{margin:.25rem 0}a{color:inherit}';

function page(locale: string, title: string, body: string): string {
  return `<!doctype html><html lang="${escapeHtml(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body><main>${body}</main></body></html>`;
}

function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
}

export function renderFallbackPage(input: {
  readonly config: SiteFormConfig;
  readonly state: FormSubmitState;
  readonly backHref: string;
  readonly action: string;
}): string {
  const { config, state, backHref } = input;
  const back = `<p><a href="${escapeHtml(backHref)}">←</a></p>`;
  switch (state.status) {
    case FormSubmitStatus.Success:
      return page(
        config.locale,
        config.successTitle,
        `<div role="status"><h1>${escapeHtml(config.successTitle)}</h1><p>${escapeHtml(config.successMessage)}</p></div>${back}`,
      );
    case FormSubmitStatus.Confirm: {
      const values = state.values ?? {};
      const fields = config.fields
        .map((field) => {
          const value = values[field.name];
          const isBoolean =
            field.definition.type === FormFieldType.Checkbox ||
            field.definition.type === FormFieldType.Consent;
          if (isBoolean) return value === true ? hidden(field.name, 'on') : '';
          return typeof value === 'string' ? hidden(field.name, value) : '';
        })
        .join('');
      return page(
        config.locale,
        config.submitLabel,
        `<p role="status">${escapeHtml(config.confirmMessage)}</p><form method="post" action="${escapeHtml(input.action)}">${hidden(FormHiddenField.Form, config.formId)}${hidden(FormHiddenField.Locale, config.locale)}${hidden(FormHiddenField.Page, backHref)}${state.token ? hidden(FormHiddenField.Token, state.token) : ''}${fields}<button type="submit">${escapeHtml(config.submitLabel)}</button></form>${back}`,
      );
    }
    case FormSubmitStatus.Invalid: {
      const items = config.fields
        .flatMap((field) => {
          const code = state.errors?.[field.name];
          return code
            ? [
                `<li>${escapeHtml(field.label || field.name)}: ${escapeHtml(DEFAULT_ERROR_MESSAGES[code])}</li>`,
              ]
            : [];
        })
        .join('');
      return page(
        config.locale,
        config.submitLabel,
        `<div role="alert"><ul>${items}</ul></div>${back}`,
      );
    }
    case FormSubmitStatus.RateLimited:
    case FormSubmitStatus.Error:
    case FormSubmitStatus.Idle:
      return page(
        config.locale,
        config.submitLabel,
        `<p role="alert">${escapeHtml(state.status === FormSubmitStatus.RateLimited ? 'Too many submissions. Please try again later.' : 'Something went wrong. Please try again.')}</p>${back}`,
      );
  }
}
