'use client';

import { type FormEvent, type ReactNode, useState } from 'react';

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

/**
 * Add a person (→ temporary password) or edit name/role. When editing,
 * `details` (2FA, dates) and `actions` (reset password, sign out, disable,
 * delete) are shown below the form.
 */
export function UserFormDialog({
  open,
  user,
  details,
  actions,
  onClose,
  onCreated,
  onSaved,
}: {
  open: boolean;
  user: EditableUser | null;
  details?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  onCreated: (email: string, temporaryPassword: string) => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<string>(user?.role ?? 'manager');
  const create = useAction(createUserAction, { toastOnSuccess: true });
  const update = useAction(updateUserAction);
  const action = user ? update : create;
  const title = user ? 'Edit person' : 'Add person';

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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={submit} noValidate aria-label={title}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {user
                ? user.email
                : 'A temporary password is created. They change it at first sign-in.'}
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
              {user ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
        {user && (details || actions) ? (
          <div className="flex flex-col gap-4 border-t pt-4">
            {details}
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
