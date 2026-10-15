import { projectConfig } from '@project/config';

/** Internal route prefix of the admin app (`src/app/(admin)/admin`). */
export const ADMIN_INTERNAL_PREFIX = '/admin';

/** Public admin URL for a sub path, honoring `projectConfig.adminPath`. */
export function adminHref(subPath = ''): string {
  const base = projectConfig.adminPath;
  if (!subPath || subPath === '/') return base;
  return `${base}${subPath.startsWith('/') ? subPath : `/${subPath}`}`;
}

export const AdminRoute = {
  Overview: '',
  Login: '/login',
  ChangePassword: '/change-password',
  Account: '/account',
  Pages: '/pages',
  Managers: '/managers',
  Settings: '/settings',
  Security: '/security',
  Activity: '/security/activity',
  NotAllowed: '/not-allowed',
  /** Preview mode (no database): the only admin page, a setup guide. */
  Setup: '/setup',
} as const;
export type AdminRoute = (typeof AdminRoute)[keyof typeof AdminRoute];

/** Areas under /admin/pages next to the page editor (`/admin/pages/<area>/<id>`). */
export const PagesArea = {
  Collections: 'collections',
  SiteWide: 'site-wide',
  Forms: 'forms',
  Shared: 'shared',
} as const;
export type PagesArea = (typeof PagesArea)[keyof typeof PagesArea];

export function pagesAreaHref(area: PagesArea, ...segments: readonly string[]): string {
  return [adminHref(AdminRoute.Pages), area, ...segments].join('/');
}

/** Private-mode visitor login page. */
export const ACCESS_PATH = '/access';

export function isAdminPath(pathname: string): boolean {
  const base = projectConfig.adminPath;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** True when `adminPath` is not the internal `/admin` folder (the usual case for projects). */
export function hasCustomAdminPath(): boolean {
  return projectConfig.adminPath !== ADMIN_INTERNAL_PREFIX;
}

/** Public admin URL path → the internal app route (`/<adminPath>/pages` → `/admin/pages`). */
export function toInternalAdminPath(pathname: string): string {
  return `${ADMIN_INTERNAL_PREFIX}${pathname.slice(projectConfig.adminPath.length)}`;
}

/** The internal admin folder, reachable only through a rewrite when `adminPath` is custom. */
export function isInternalAdminPath(pathname: string): boolean {
  return pathname === ADMIN_INTERNAL_PREFIX || pathname.startsWith(`${ADMIN_INTERNAL_PREFIX}/`);
}

/**
 * Validates a post-login redirect target: same-origin relative paths only.
 * Falls back when the value is missing or could leave the site (`//evil.com`).
 */
export function safeRedirectPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//'))
    return fallback;
  if (value.includes('\\') || /[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
