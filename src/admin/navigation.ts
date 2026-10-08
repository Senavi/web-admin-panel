import {
  FileTextIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  SettingsIcon,
  ShieldIcon,
  UserCogIcon,
  UsersIcon,
} from 'lucide-react';

import { can, Permission } from '@/core/auth/permissions';
import type { Role } from '@/core/auth/roles';
import { adminHref, AdminRoute } from '@/core/project/paths';

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly permission: Permission;
}

/** Main sidebar items. Filtered by role; every route also checks the permission server-side. */
export const MAIN_NAV: readonly NavItem[] = [
  {
    label: 'Overview',
    href: adminHref(AdminRoute.Overview),
    icon: LayoutDashboardIcon,
    permission: Permission.OverviewView,
  },
  {
    label: 'Pages',
    href: adminHref(AdminRoute.Pages),
    icon: FileTextIcon,
    permission: Permission.PagesView,
  },
  {
    label: 'Managers',
    href: adminHref(AdminRoute.Managers),
    icon: UsersIcon,
    permission: Permission.ManagersManage,
  },
  {
    label: 'Settings',
    href: adminHref(AdminRoute.Settings),
    icon: SettingsIcon,
    permission: Permission.SettingsManage,
  },
  {
    label: 'Security',
    href: adminHref(AdminRoute.Security),
    icon: ShieldIcon,
    permission: Permission.SecurityManage,
  },
];

export const ACCOUNT_NAV: NavItem = {
  label: 'Account',
  href: adminHref(AdminRoute.Account),
  icon: UserCogIcon,
  permission: Permission.AccountManage,
};

export function navForRole(role: Role): NavItem[] {
  return MAIN_NAV.filter((item) => can(role, item.permission));
}

/** Labels for breadcrumb segments that are not nav items. */
export const SEGMENT_LABELS: Record<string, string> = {
  account: 'Account',
  pages: 'Pages',
  managers: 'Managers',
  settings: 'Settings',
  security: 'Security',
};

/** True when `pathname` is `href` or below it (Overview only matches exactly). */
export function isActiveHref(pathname: string, href: string): boolean {
  if (href === adminHref(AdminRoute.Overview)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
