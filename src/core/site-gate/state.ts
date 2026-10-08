import { projectConfig } from '@project/config';

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
}

export const SITE_STATE_PATH = '/api/site-state';
export const SITE_STATE_KEY_HEADER = 'x-site-state-key';

export function defaultSiteState(): SiteState {
  return {
    defaultLocale: projectConfig.defaultLocale,
    enabledLocales: [...projectConfig.localeCodes],
    supportedLocales: [...projectConfig.localeCodes],
    maintenance: false,
    privateMode: false,
    indexing: true,
    staff: {},
  };
}

/** Pages must not be indexed when indexing is off or the site is private. */
export function isNoindex(state: Pick<SiteState, 'indexing' | 'privateMode'>): boolean {
  return !state.indexing || state.privateMode;
}
