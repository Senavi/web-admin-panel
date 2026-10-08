'use client';

import type { FormEvent } from 'react';

import { TextField } from '@/admin/components/forms/text-field';
import { formToObject, useAction } from '@/admin/hooks/use-action';
import { Button } from '@/admin/ui/button';
import { FieldGroup } from '@/admin/ui/field';
import { Spinner } from '@/admin/ui/spinner';
import { updateProfileAction } from '@/core/auth/actions';

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const action = useAction(updateProfileAction);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void action.run(formToObject(event.currentTarget));
  };
  return (
    <form method="post" onSubmit={submit} noValidate>
      <FieldGroup>
        <TextField name="email" label="Email" value={email} readOnly disabled />
        <TextField
          name="name"
          label="Name"
          defaultValue={name}
          autoComplete="name"
          errors={action.errorsFor('name')}
          required
        />
        <div>
          <Button type="submit" disabled={action.pending}>
            {action.pending ? <Spinner /> : null}
            Save
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
