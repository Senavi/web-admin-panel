'use client';

import { LogOutIcon, UserCogIcon } from 'lucide-react';
import Link from 'next/link';

import { ACCOUNT_NAV } from '@/admin/navigation';
import { Avatar, AvatarFallback } from '@/admin/ui/avatar';
import { Button } from '@/admin/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/admin/ui/dropdown-menu';
import { signOutAction } from '@/core/auth/actions';
import { ROLE_LABELS, type Role } from '@/core/auth/roles';

export function UserMenu({ name, email, role }: { name: string; email: string; role: Role }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Open user menu"
          />
        }
      >
        <Avatar className="size-8">
          <AvatarFallback>{initials || '?'}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="truncate">{name}</span>
              <span className="text-xs font-normal truncate text-muted-foreground">{email}</span>
              <span className="text-xs font-normal text-muted-foreground">{ROLE_LABELS[role]}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={ACCOUNT_NAV.href} />}>
          <UserCogIcon />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void signOutAction()}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
