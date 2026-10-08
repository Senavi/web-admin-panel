import { z } from 'zod';

import { Role, UserStatus } from '@/core/auth/roles';
import { emailSchema } from '@/core/auth/validation';

export const roleSchema = z.enum([Role.Admin, Role.Manager]);

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(80),
  email: emailSchema,
  role: roleSchema,
});

export const updateUserSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1, 'Enter a name.').max(80),
  role: roleSchema,
});

export const userIdSchema = z.object({ id: z.string().min(1).max(64) });

export const setStatusSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum([UserStatus.Active, UserStatus.Disabled]),
});
