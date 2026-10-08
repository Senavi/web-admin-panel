/** Admin UI is English-only; format dates and numbers consistently regardless of browser locale. */
export const ADMIN_LOCALE = 'en-GB';

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString(ADMIN_LOCALE, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(ADMIN_LOCALE, { dateStyle: 'medium' });
}

export function formatNumber(value: number): string {
  return value.toLocaleString(ADMIN_LOCALE);
}
