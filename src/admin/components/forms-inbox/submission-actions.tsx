'use client';

import { ArchiveIcon, MailOpenIcon, MailIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useAction } from '@/admin/hooks/use-action';
import { useConfirm } from '@/admin/hooks/use-confirm';
import { Button } from '@/admin/ui/button';
import { deleteSubmissionAction, setSubmissionStatusAction } from '@/core/forms/inbox-actions';
import { SubmissionStatus } from '@/core/forms/inbox-status';

/** Mark read/unread, archive, delete (delete only for admins; checked again on the server). */
export function SubmissionActions({
  formId,
  id,
  status,
  canDelete,
  listHref,
}: {
  formId: string;
  id: string;
  status: SubmissionStatus;
  canDelete: boolean;
  listHref: string;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const setStatus = useAction(setSubmissionStatusAction, { onSuccess: () => router.refresh() });
  const remove = useAction(deleteSubmissionAction, { onSuccess: () => router.push(listHref) });
  const busy = setStatus.pending || remove.pending;
  const run = (next: SubmissionStatus) => void setStatus.run({ formId, ids: [id], status: next });

  return (
    <div className="flex flex-wrap gap-2">
      {status === SubmissionStatus.New ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => run(SubmissionStatus.Read)}
        >
          <MailOpenIcon />
          Mark as read
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => run(SubmissionStatus.New)}
        >
          <MailIcon />
          Mark as unread
        </Button>
      )}
      {status !== SubmissionStatus.Archived ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => run(SubmissionStatus.Archived)}
        >
          <ArchiveIcon />
          Archive
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            const yes = await confirm({
              title: 'Delete this submission?',
              description: 'It is removed permanently (for example after a GDPR request).',
              confirmLabel: 'Delete',
              destructive: true,
            });
            if (yes) await remove.run({ formId, id });
          }}
        >
          <Trash2Icon />
          Delete
        </Button>
      ) : null}
      {dialog}
    </div>
  );
}
