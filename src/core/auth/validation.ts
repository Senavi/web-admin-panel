import { z } from 'zod';

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password-policy';

/** Input schemas shared by auth forms (client) and server actions. */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.'));

export const loginSchema = z.object({
  email: emailSchema,
  // Length is not validated at login (the policy only applies when setting a password).
  password: z.string().min(1, 'Enter your password.').max(PASSWORD_MAX_LENGTH),
  next: z.string().optional(),
});

export const TwoFactorMethod = { Totp: 'totp', Backup: 'backup' } as const;

export const twoFactorCodeSchema = z.object({
  code: z.string().trim().min(6, 'Enter the code.').max(32),
  method: z.enum([TwoFactorMethod.Totp, TwoFactorMethod.Backup]),
  next: z.string().optional(),
});

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: 'Choose a password different from the current one.',
    path: ['newPassword'],
  });

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
});

export const passwordConfirmSchema = z.object({
  password: z.string().min(1, 'Enter your password.'),
});

export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});

export const sessionIdSchema = z.object({ sessionId: z.uuid() });
