/** Non-sensitive cookie telling the site UI to show the staff banner. */
export const SITE_NOTICE_COOKIE = 'site_notice';

export const SiteNotice = {
  Maintenance: 'maintenance',
  Private: 'private',
} as const;
export type SiteNotice = (typeof SiteNotice)[keyof typeof SiteNotice];
