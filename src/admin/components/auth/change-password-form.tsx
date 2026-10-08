'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';

import { formToObject, useAction } from '@/admin/hooks/use-action';
import { Button } from '@/admin/ui/button';
import { FieldGroup } from '@/admin/ui/field';
import { Spinner } from '@/admin/ui/spinner';
import { changePasswordAction } from '@/core/auth/actions';
import { PASSWORD_MIN_LENGTH } from '@/core/auth/password-policy';

import { TextField } from '../forms/text-field';

export function ChangePasswordForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const action = useAction(changePasswordAction, {
    onSuccess: () => {
      if (redirectTo) router.replace(redirectTo);
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    void action.run(formToObject(form)).then((result) => {
      if (result?.ok) form.reset();
    });
  };

  return (
    <form method="post" onSubmit={submit} noValidate>
      <FieldGroup>
        <TextField
          name="currentPassword"
          type="password"
          label="Current password"
          autoComplete="current-password"
          errors={action.errorsFor('currentPassword')}
          required
        />
        <TextField
          name="newPassword"
          type="password"
          label="New password"
          autoComplete="new-password"
          description={`At least ${PASSWORD_MIN_LENGTH} characters. Avoid common passwords.`}
          errors={action.errorsFor('newPassword')}
          required
        />
        <TextField
          name="confirmPassword"
          type="password"
          label="Repeat new password"
          autoComplete="new-password"
          errors={action.errorsFor('confirmPassword')}
          required
        />
        <Button type="submit" disabled={action.pending}>
          {action.pending ? <Spinner /> : null}
          Change password
        </Button>
      </FieldGroup>
    </form>
  );
}
