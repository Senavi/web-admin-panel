import type { LocaleState } from '@/core/i18n/routing';

/**
 * Public site state the request proxy needs on every request, served by the
 * cached `/api/site-state` endpoint (tags: settings, staff) so the proxy never
 * touches the database. docs/ARCHITECTURE.md § Site gate.
 */
export interface SiteState extends LocaleState {
  readonly maintenance: boolean;
  readonly privateMode: boolean;
  readonly indexing: boolean;
  /** Active staff user id → current session version (validates site-gate cookies). */
  readonly staff: Readonly<Record<string, number>>;
  /** Known site route patterns (registry pages + project.config siteRoutes); others → 404. */
  readonly routes: readonly string[];
}

/** Internal site routes the proxy rewrites to (never shown in the address bar). */
export const SiteRoute = {
  Maintenance: '/maintenance-mode',
  NotFound: '/error-404',
} as const;

export const SITE_STATE_PATH = '/api/site-state';
export const SITE_STATE_KEY_HEADER = 'x-site-state-key';

/** Pages must not be indexed when indexing is off or the site is private. */
export function isNoindex(state: Pick<SiteState, 'indexing' | 'privateMode'>): boolean {
  return !state.indexing || state.privateMode;
}
