import { Role } from './roles';

/**
 * Central permission map. Every admin page, server action and route handler
 * checks one of these on the server (`requirePermission` / `assertPermission`).
 * Navigation is filtered with the same map, but hiding UI is not access control.
 */
export const Permission = {
  OverviewView: 'overview.view',
  PagesView: 'pages.view',
  PagesEdit: 'pages.edit',
  MediaUpload: 'media.upload',
  /** Read the form inbox, mark read/archive, export CSV. */
  FormsView: 'forms.view',
  /** Delete submissions (GDPR requests). */
  FormsDelete: 'forms.delete',
  /** Settings → Forms: destinations and retention. */
  FormsSettings: 'forms.settings',
  ManagersManage: 'managers.manage',
  SettingsManage: 'settings.manage',
  SecurityManage: 'security.manage',
  AccountManage: 'account.manage',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const MANAGER_PERMISSIONS: readonly Permission[] = [
  Permission.OverviewView,
  Permission.PagesView,
  Permission.PagesEdit,
  Permission.MediaUpload,
  Permission.FormsView,
  Permission.AccountManage,
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  [Role.Admin]: new Set(Object.values(Permission)),
  [Role.Manager]: new Set(MANAGER_PERMISSIONS),
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
