/** Link targets for contact fields (`f.email()`, `f.phone()`). */

export function mailtoHref(email: string): string {
  return `mailto:${email.trim()}`;
}

/** `+380 (44) 000-00-00` → `tel:+380440000000`. */
export function telHref(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^0-9]/g, '');
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}
