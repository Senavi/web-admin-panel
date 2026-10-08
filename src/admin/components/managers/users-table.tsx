'use client';

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { MoreHorizontalIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { SimpleSelect } from '@/admin/components/forms/simple-select';
import { useConfirm } from '@/admin/hooks/use-confirm';
import { formatDate, formatDateTime } from '@/admin/lib/format';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/admin/ui/dropdown-menu';
import { Input } from '@/admin/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/ui/table';
import type { ActionResult } from '@/core/actions/result';
import { ROLE_LABELS, type Role, ROLES, UserStatus } from '@/core/auth/roles';
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

const ALL_ROLES = 'all';

export function UsersTable({
  users,
  currentUserId,
}: {
  users: readonly UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLES);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [editing, setEditing] = useState<EditableUser | null>(null);
  const [adding, setAdding] = useState(false);
  const [password, setPassword] = useState<{ email: string; value: string } | null>(null);

  const perform = async <T,>(
    action: () => Promise<ActionResult<T>>,
    onSuccess?: (data: T) => void,
  ) => {
    const result = await action();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.message) toast.success(result.message);
    onSuccess?.(result.data);
    router.refresh();
  };

  const data = useMemo(
    () => users.filter((user) => roleFilter === ALL_ROLES || user.role === roleFilter),
    [users, roleFilter],
  );

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.name}
            {row.original.id === currentUserId ? (
              <span className="text-muted-foreground"> (you)</span>
            ) : null}
          </span>
        ),
      },
      { accessorKey: 'email', header: 'Email' },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => <Badge variant="secondary">{ROLE_LABELS[row.original.role]}</Badge>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === UserStatus.Active ? 'outline' : 'destructive'}>
            {row.original.status === UserStatus.Active ? 'Active' : 'Disabled'}
          </Badge>
        ),
      },
      {
        accessorKey: 'twoFactorEnabled',
        header: '2FA',
        cell: ({ row }) => (row.original.twoFactorEnabled ? 'On' : 'Off'),
      },
      {
        accessorKey: 'lastLoginAt',
        header: 'Last sign-in',
        cell: ({ row }) =>
          row.original.lastLoginAt ? formatDateTime(row.original.lastLoginAt) : 'Never',
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const user = row.original;
          const disabled = user.status === UserStatus.Disabled;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.email}`} />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(user)}>
                  Edit name & role
                </DropdownMenuItem>
                <DropdownMenuItem
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
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    void confirm({
                      title: 'Reset password?',
                      description: `${user.email} gets a new temporary password and is signed out everywhere.`,
                      confirmLabel: 'Reset password',
                    }).then((yes) => {
                      if (yes)
                        void perform(
                          () => resetUserPasswordAction({ id: user.id }),
                          (result) =>
                            setPassword({ email: user.email, value: result.temporaryPassword }),
                        );
                    })
                  }
                >
                  Reset password
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void perform(() => revokeUserSessionsAction({ id: user.id }))}
                >
                  Revoke sessions
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() =>
                    void confirm({
                      title: 'Delete user?',
                      description: `${user.email} will be permanently deleted. Their edits stay in the history.`,
                      confirmLabel: 'Delete',
                      destructive: true,
                    }).then((yes) => {
                      if (yes) void perform(() => deleteUserAction({ id: user.id }));
                    })
                  }
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers are stable enough for a small admin table
    [currentUserId],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions by design
  const table = useReactTable({
    data: data as UserRow[],
    columns,
    state: { globalFilter: query, sorting },
    onGlobalFilterChange: setQuery,
    onSortingChange: setSorting,
    globalFilterFn: (row, _column, value: string) =>
      `${row.original.name} ${row.original.email}`.toLowerCase().includes(value.toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      {dialog}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email"
            aria-label="Search users"
            className="ps-8"
          />
        </div>
        <SimpleSelect
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: ALL_ROLES, label: 'All roles' },
            ...ROLES.map((role: Role) => ({ value: role, label: ROLE_LABELS[role] })),
          ]}
          ariaLabel="Filter by role"
          className="w-40"
        />
        <Button onClick={() => setAdding(true)}>
          <PlusIcon />
          Add user
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table aria-label="Users">
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No users match.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <UserFormDialog
        key={editing?.id ?? (adding ? 'new' : 'closed')}
        open={adding || editing !== null}
        user={editing}
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
    </div>
  );
}
