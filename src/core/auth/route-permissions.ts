import { adminHref, AdminRoute } from '@/core/project/paths';

import { Permission } from './permissions';

/**
 * Admin route prefixes and the permission each requires. Pages check the
 * permission on the server; the proxy uses this map (with the signed gate
 * cookie's role) to answer early with a real 404 status.
 */
export const ADMIN_ROUTE_PERMISSIONS: ReadonlyArray<{
  readonly path: string;
  readonly permission: Permission;
}> = [
  { path: adminHref(AdminRoute.Managers), permission: Permission.ManagersManage },
  { path: adminHref(AdminRoute.Settings), permission: Permission.SettingsManage },
  { path: adminHref(AdminRoute.Security), permission: Permission.SecurityManage },
];

export function permissionForAdminPath(pathname: string): Permission | null {
  const match = ADMIN_ROUTE_PERMISSIONS.find(
    (route) => pathname === route.path || pathname.startsWith(`${route.path}/`),
  );
  return match?.permission ?? null;
}
