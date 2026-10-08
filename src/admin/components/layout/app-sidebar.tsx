'use client';

import { LogOutIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isActiveHref, navForRole } from '@/admin/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/admin/ui/sidebar';
import { signOutAction } from '@/core/auth/actions';
import type { Role } from '@/core/auth/roles';
import { adminHref, AdminRoute } from '@/core/project/paths';

export function AppSidebar({ role, siteName }: { role: Role; siteName: string }) {
  const pathname = usePathname();
  const items = navForRole(role);

  return (
    <Sidebar collapsible="icon" aria-label="Admin navigation">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href={adminHref(AdminRoute.Overview)} />}
              tooltip={siteName}
            >
              <span className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold flex size-8 shrink-0 items-center justify-center rounded-md">
                {siteName.slice(0, 1).toUpperCase()}
              </span>
              <span className="leading-tight flex flex-col">
                <span className="font-medium truncate">{siteName}</span>
                <span className="text-xs text-muted-foreground">Admin</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActiveHref(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={<Link href={item.href} aria-current={active ? 'page' : undefined} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <form action={signOutAction}>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton type="submit" tooltip="Sign out">
                <LogOutIcon />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </form>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
