'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { TextField } from '@/admin/components/forms/text-field';
import { formToObject, useAction } from '@/admin/hooks/use-action';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { FieldDescription, FieldGroup } from '@/admin/ui/field';
import { Spinner } from '@/admin/ui/spinner';
import {
  confirmTwoFactorAction,
  disableTwoFactorAction,
  startTwoFactorSetupAction,
  type TwoFactorSetup,
} from '@/core/auth/actions';

/** Enable (scan QR → confirm code → save backup codes) or disable TOTP 2FA. */
export function TwoFactorCard({ enabled, required }: { enabled: boolean; required: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const start = useAction(startTwoFactorSetupAction, {
    toastOnSuccess: false,
    onSuccess: setSetup,
  });
  const confirm = useAction(confirmTwoFactorAction, {
    onSuccess: () => {
      setSetup(null);
      router.refresh();
    },
  });
  const disable = useAction(disableTwoFactorAction, { onSuccess: () => router.refresh() });

  const onSubmit =
    (run: (input: Record<string, string>) => Promise<unknown>) =>
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void run(formToObject(event.currentTarget));
    };

  if (enabled) {
    return (
      <form onSubmit={onSubmit(disable.run)} noValidate>
        <FieldGroup>
          <div className="flex items-center gap-2">
            <Badge>On</Badge>
            <span className="text-sm text-muted-foreground">
              Sign-in requires a code from your authenticator app.
            </span>
          </div>
          {required ? (
            <FieldDescription>
              Two-factor authentication is required for admins by the security policy.
            </FieldDescription>
          ) : (
            <>
              <TextField
                name="password"
                type="password"
                label="Confirm with your password to turn it off"
                autoComplete="current-password"
                errors={disable.errorsFor('password')}
              />
              <div>
                <Button type="submit" variant="destructive" disabled={disable.pending}>
                  {disable.pending ? <Spinner /> : null}
                  Turn off two-factor authentication
                </Button>
              </div>
            </>
          )}
        </FieldGroup>
      </form>
    );
  }

  if (setup) {
    return (
      <form onSubmit={onSubmit(confirm.run)} noValidate>
        <FieldGroup>
          <p className="text-sm">
            1. Scan this QR code with an authenticator app (1Password, Google Authenticator,
            Authy…).
          </p>
          <div
            className="bg-white w-44 rounded-md p-2"
            aria-label="Two-factor QR code"
            role="img"
            // SVG generated server-side by the `qrcode` library from the TOTP URI.
            dangerouslySetInnerHTML={{ __html: setup.qrSvg }}
          />
          <p className="text-sm text-muted-foreground">
            Can’t scan it? Enter this key manually:{' '}
            <code className="font-mono break-all" data-testid="totp-secret">
              {new URL(setup.secretUri).searchParams.get('secret')}
            </code>
          </p>
          <p className="text-sm">
            2. Store these backup codes somewhere safe. Each code works once.
          </p>
          <ul className="text-sm grid grid-cols-2 gap-1 rounded-md border p-3 font-mono">
            {setup.backupCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <TextField
            name="code"
            label="3. Enter the 6-digit code from the app"
            inputMode="numeric"
            autoComplete="one-time-code"
            errors={confirm.errorsFor('code')}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={confirm.pending}>
              {confirm.pending ? <Spinner /> : null}
              Turn on
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
              Cancel
            </Button>
          </div>
        </FieldGroup>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit(start.run)} noValidate>
      <FieldGroup>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Off</Badge>
          {required ? (
            <span className="text-destructive text-sm">
              Required for admins. Turn it on to continue.
            </span>
          ) : null}
        </div>
        <TextField
          name="password"
          type="password"
          label="Confirm with your password to set it up"
          autoComplete="current-password"
          errors={start.errorsFor('password')}
        />
        <div>
          <Button type="submit" disabled={start.pending}>
            {start.pending ? <Spinner /> : null}
            Set up two-factor authentication
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
