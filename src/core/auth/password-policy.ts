import { COMMON_PASSWORDS } from './data/common-passwords';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
const MIN_DISTINCT_CHARACTERS = 5;

const commonPasswords = new Set(COMMON_PASSWORDS);

export type PasswordCheck = { ok: true } | { ok: false; message: string };

/**
 * Password rules (docs/SECURITY.md): length 12–128, not a known common password,
 * not trivially repetitive, and not containing the user's email name.
 */
export function checkPassword(password: string, context: { email?: string } = {}): PasswordCheck {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Use at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, message: `Use at most ${PASSWORD_MAX_LENGTH} characters.` };
  }
  const normalized = password.toLowerCase();
  if (commonPasswords.has(normalized)) {
    return { ok: false, message: 'This password is too common. Choose a different one.' };
  }
  if (new Set(normalized).size < MIN_DISTINCT_CHARACTERS) {
    return { ok: false, message: 'This password is too repetitive.' };
  }
  const emailName = context.email?.split('@')[0]?.toLowerCase();
  if (emailName && emailName.length >= 4 && normalized.includes(emailName)) {
    return { ok: false, message: 'The password must not contain your email address.' };
  }
  return { ok: true };
}

/** Random temporary password (shown once to the admin who created/reset the user). */
export function generateTemporaryPassword(length = 20): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}
