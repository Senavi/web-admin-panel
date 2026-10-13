/**
 * Preview mode: a production build or server without `DATABASE_URL` (a fresh
 * deploy before Supabase is connected). The site renders from seed content,
 * is never indexable, forms and analytics are off, and the admin shows a setup
 * guide. docs/DECISIONS.md D-079.
 *
 * Pure env check (no `server-only`): used by the env schema, the request proxy
 * and scripts.
 */
export function isPreviewMode(source: Record<string, string | undefined> = process.env): boolean {
  return source.NODE_ENV === 'production' && !source.DATABASE_URL?.trim();
}

/** Logged once when a server instance starts in preview mode. */
export const PREVIEW_MODE_LOG = 'Preview mode: no DATABASE_URL';

/** Shown by forms and the form API while the site has no database. */
export const FORM_NOT_CONNECTED_MESSAGE = 'This form isn’t connected yet.';
