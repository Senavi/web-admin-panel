import { projectConfig } from '@project/config';

import type { LocaleState } from '@/core/i18n/routing';

/**
 * Public site state the request proxy needs on every request. Until the
 * site-gate phase this is derived from project.config; then it is served by
 * the cached `/api/site-state` endpoint and refreshed on settings save.
 */
export interface SiteState extends LocaleState {
  readonly maintenance: boolean;
  readonly privateMode: boolean;
  readonly indexing: boolean;
}

export function defaultSiteState(): SiteState {
  return {
    defaultLocale: projectConfig.defaultLocale,
    enabledLocales: [...projectConfig.localeCodes],
    supportedLocales: [...projectConfig.localeCodes],
    maintenance: false,
    privateMode: false,
    indexing: true,
  };
}
