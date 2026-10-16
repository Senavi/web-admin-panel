/** Checks an edited interface text against the English default (pure). */

import { MAX_UI_TEXT_LENGTH } from './model';

const PLACEHOLDER = /\{(\w+)\}/g;

function placeholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? '').sort();
}

/**
 * A text may use only the `{placeholders}` of the default (they are replaced
 * with a date, a number…); any other braces would break the page. Returns an
 * error message or null.
 */
export function validateUiText(defaultText: string, value: string): string | null {
  if (value.trim() === '') return 'Enter a text, or reset it to the default.';
  if (value.length > MAX_UI_TEXT_LENGTH) return `Use at most ${MAX_UI_TEXT_LENGTH} characters.`;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
    return 'This text has invalid characters.';
  if (value.includes("'{")) return 'Remove the apostrophe before the opening curly bracket.';
  const expected = placeholders(defaultText);
  const actual = placeholders(value);
  if (expected.join() !== actual.join()) {
    return expected.length > 0
      ? `Keep ${expected.map((name) => `{${name}}`).join(' and ')} in the text: it is replaced automatically.`
      : 'Curly brackets { } are not allowed in this text.';
  }
  if (value.replace(PLACEHOLDER, '').match(/[{}]/))
    return 'Curly brackets { } are not allowed here.';
  return null;
}
