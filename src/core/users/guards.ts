import { Role, UserStatus } from '@/core/auth/roles';

/** User-management safety rules (docs/SPEC.md §7), pure for unit testing. */
export type UserChange =
  | { readonly type: 'role'; readonly role: Role }
  | { readonly type: 'status'; readonly status: UserStatus }
  | { readonly type: 'delete' };

export interface GuardContext {
  readonly actorId: string;
  readonly target: { readonly id: string; readonly role: Role; readonly status: UserStatus };
  /** Number of active admins right now (including the target if it is one). */
  readonly activeAdmins: number;
}

export function userChangeViolation(change: UserChange, context: GuardContext): string | null {
  const self = context.actorId === context.target.id;
  const isLastActiveAdmin =
    context.target.role === Role.Admin &&
    context.target.status === UserStatus.Active &&
    context.activeAdmins <= 1;

  switch (change.type) {
    case 'delete':
      if (self) return 'You cannot delete your own account.';
      if (isLastActiveAdmin) return 'The last active admin cannot be deleted.';
      return null;
    case 'status':
      if (change.status === UserStatus.Disabled && self)
        return 'You cannot disable your own account.';
      if (change.status === UserStatus.Disabled && isLastActiveAdmin)
        return 'The last active admin cannot be disabled.';
      return null;
    case 'role':
      if (change.role !== Role.Admin && context.target.role === Role.Admin) {
        if (self) return 'You cannot remove your own admin role.';
        if (isLastActiveAdmin) return 'The last active admin cannot be demoted.';
      }
      return null;
  }
}
