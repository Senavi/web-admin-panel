export const Role = {
  Admin: 'admin',
  Manager: 'manager',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ROLES: readonly Role[] = [Role.Admin, Role.Manager];

export const ROLE_LABELS: Record<Role, string> = {
  [Role.Admin]: 'Admin',
  [Role.Manager]: 'Manager',
};

export const UserStatus = {
  Active: 'active',
  Disabled: 'disabled',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
