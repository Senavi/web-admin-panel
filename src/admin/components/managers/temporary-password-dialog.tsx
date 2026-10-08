'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/admin/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/admin/ui/dialog';
import { Input } from '@/admin/ui/input';

/** Shows a temporary password exactly once. */
export function TemporaryPasswordDialog({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={password !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Temporary password</DialogTitle>
          <DialogDescription>
            Share it securely with {email}. It is shown only once; the user must choose a new
            password at first sign-in.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            readOnly
            value={password ?? ''}
            aria-label="Temporary password"
            className="font-mono"
            data-testid="temporary-password"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Copy password"
            onClick={() => {
              void navigator.clipboard.writeText(password ?? '').then(() => setCopied(true));
            }}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
