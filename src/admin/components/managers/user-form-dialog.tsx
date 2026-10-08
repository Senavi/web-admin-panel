'use client';

import { type FormEvent, useState } from 'react';

import { SimpleSelect } from '@/admin/components/forms/simple-select';
import { TextField } from '@/admin/components/forms/text-field';
import { formToObject, useAction } from '@/admin/hooks/use-action';
import { Button } from '@/admin/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/admin/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/admin/ui/field';
import { Spinner } from '@/admin/ui/spinner';
import { ROLE_LABELS, ROLES, type Role } from '@/core/auth/roles';
import { createUserAction, updateUserAction } from '@/core/users/actions';

export interface EditableUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
}

const roleOptions = ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

/** Add a user (→ temporary password) or edit name/role. */
export function UserFormDialog({
  open,
  user,
  onClose,
  onCreated,
  onSaved,
}: {
  open: boolean;
  user: EditableUser | null;
  onClose: () => void;
  onCreated: (email: string, temporaryPassword: string) => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<string>(user?.role ?? 'manager');
  const create = useAction(createUserAction, { toastOnSuccess: true });
  const update = useAction(updateUserAction);
  const action = user ? update : create;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values: Record<string, string> = { ...formToObject(event.currentTarget), role };
    if (user) {
      void update.run({ ...values, id: user.id }).then((result) => {
        if (result?.ok) onSaved();
      });
    } else {
      void create.run(values).then((result) => {
        if (result?.ok) onCreated(values.email ?? '', result.data.temporaryPassword);
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form
          method="post"
          onSubmit={submit}
          noValidate
          aria-label={user ? 'Edit user' : 'Add user'}
        >
          <DialogHeader>
            <DialogTitle>{user ? 'Edit user' : 'Add user'}</DialogTitle>
            <DialogDescription>
              {user
                ? user.email
                : 'A temporary password is generated. The user must change it at first sign-in.'}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <TextField
              name="name"
              label="Name"
              defaultValue={user?.name}
              errors={action.errorsFor('name')}
              required
            />
            {user ? null : (
              <TextField
                name="email"
                type="email"
                label="Email"
                errors={action.errorsFor('email')}
                required
              />
            )}
            <Field>
              <FieldLabel htmlFor="user-role">Role</FieldLabel>
              <SimpleSelect id="user-role" value={role} onChange={setRole} options={roleOptions} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.pending}>
              {action.pending ? <Spinner /> : null}
              {user ? 'Save' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
