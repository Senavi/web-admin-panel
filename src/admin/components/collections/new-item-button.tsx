'use client';

import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useAction } from '@/admin/hooks/use-action';
import { Button } from '@/admin/ui/button';
import { Spinner } from '@/admin/ui/spinner';
import { createItemAction } from '@/core/collections/actions';

/** Creates a draft and opens its editor. */
export function NewItemButton({
  collectionId,
  itemLabel,
  basePath,
}: {
  collectionId: string;
  itemLabel: string;
  basePath: string;
}) {
  const router = useRouter();
  const create = useAction(createItemAction, {
    toastOnSuccess: false,
    onSuccess: ({ itemId }) => router.push(`${basePath}/${itemId}`),
  });
  return (
    <Button
      type="button"
      onClick={() => void create.run({ collectionId })}
      disabled={create.pending}
    >
      {create.pending ? <Spinner /> : <PlusIcon />}
      New {itemLabel.toLowerCase()}
    </Button>
  );
}
