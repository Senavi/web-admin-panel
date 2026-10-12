'use client';

import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/admin/components/layout/page-header';
import { useConfirm } from '@/admin/hooks/use-confirm';
import { formatDate, formatDateTime } from '@/admin/lib/format';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/admin/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/ui/table';
import type { ActionResult } from '@/core/actions/result';
import { Role, ROLE_LABELS, ROLES, UserStatus } from '@/core/auth/roles';
import {
  deleteUserAction,
  resetUserPasswordAction,
  revokeUserSessionsAction,
  setUserStatusAction,
} from '@/core/users/actions';

import { TemporaryPasswordDialog } from './temporary-password-dialog';
import { type EditableUser, UserFormDialog } from './user-form-dialog';

export interface UserRow extends EditableUser {
  readonly status: UserStatus;
  readonly twoFactorEnabled: boolean;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

/** What each role may do, in plain words (role cards above the table). */
const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [Role.Admin]: 'Can change everything, including settings and people.',
  [Role.Manager]: 'Edits pages, blog and form texts, sees statistics and requests.',
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Managers screen: role cards, people table, add/edit dialog with every per-person action. */
export function UsersTable({
  users,
  currentUserId,
}: {
  users: readonly UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [password, setPassword] = useState<{ email: string; value: string } | null>(null);

  /** Runs an action from the edit dialog, then closes it and refreshes the list. */
  const perform = async <T,>(
    action: () => Promise<ActionResult<T>>,
    onSuccess?: (data: T) => void,
  ) => {
    const result = await action();
    setEditing(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.message) toast.success(result.message);
    onSuccess?.(result.data);
    router.refresh();
  };

  const actionsFor = (user: UserRow) => {
    const disabled = user.status === UserStatus.Disabled;
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            void confirm({
              title: 'Reset password?',
              description: `${user.email} gets a new temporary password and is signed out everywhere.`,
              confirmLabel: 'Reset password',
            }).then((yes) => {
              if (yes)
                void perform(
                  () => resetUserPasswordAction({ id: user.id }),
                  (result) => setPassword({ email: user.email, value: result.temporaryPassword }),
                );
            })
          }
        >
          Reset password
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void perform(() => revokeUserSessionsAction({ id: user.id }))}
        >
          Sign out everywhere
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            void perform(() =>
              setUserStatusAction({
                id: user.id,
                status: disabled ? UserStatus.Active : UserStatus.Disabled,
              }),
            )
          }
        >
          {disabled ? 'Enable' : 'Disable'}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() =>
            void confirm({
              title: 'Delete this person?',
              description: `${user.email} will be permanently deleted. Their edits stay in the history.`,
              confirmLabel: 'Delete',
              destructive: true,
            }).then((yes) => {
              if (yes) void perform(() => deleteUserAction({ id: user.id }));
            })
          }
        >
          Delete
        </Button>
      </>
    );
  };

  return (
    <>
      {dialog}
      <PageHeader
        title="Managers"
        description="People who can sign in to this admin."
        actions={
          <Button onClick={() => setAdding(true)}>
            <PlusIcon />
            Add person
          </Button>
        }
      />
      <section aria-label="Roles" className="grid gap-4 sm:grid-cols-2">
        {ROLES.map((role) => (
          <Card key={role} size="sm">
            <CardHeader>
              <CardTitle>
                <h2>{ROLE_LABELS[role]}</h2>
              </CardTitle>
              <CardDescription>{ROLE_DESCRIPTIONS[role]}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
      <div className="overflow-x-auto rounded-md border">
        <Table aria-label="Users">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last signed in</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {user.name}
                      {user.id === currentUserId ? (
                        <span className="text-muted-foreground"> (you)</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                    {user.status === UserStatus.Disabled ? (
                      <Badge variant="destructive">Disabled</Badge>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
                </TableCell>
                <TableCell className="text-end">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Edit ${user.email}`}
                    onClick={() => setEditing(user)}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <UserFormDialog
        key={editing?.id ?? (adding ? 'new' : 'closed')}
        open={adding || editing !== null}
        user={editing}
        details={
          editing ? (
            <dl className="flex flex-col gap-1.5">
              <Detail label="Two-factor sign-in" value={editing.twoFactorEnabled ? 'On' : 'Off'} />
              <Detail
                label="Last signed in"
                value={editing.lastLoginAt ? formatDateTime(editing.lastLoginAt) : 'Never'}
              />
              <Detail label="Added" value={formatDate(editing.createdAt)} />
            </dl>
          ) : null
        }
        actions={editing ? actionsFor(editing) : null}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onCreated={(email, value) => {
          setAdding(false);
          setPassword({ email, value });
          router.refresh();
        }}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
      <TemporaryPasswordDialog
        email={password?.email ?? ''}
        password={password?.value ?? null}
        onClose={() => setPassword(null)}
      />
    </>
  );
}
