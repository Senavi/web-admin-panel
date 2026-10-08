'use client';

import { useActionState, useState } from 'react';

import { Alert, AlertDescription } from '@/admin/ui/alert';
import { Button } from '@/admin/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/admin/ui/field';
import { Input } from '@/admin/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/admin/ui/input-otp';
import { Spinner } from '@/admin/ui/spinner';
import { loginFormAction, type LoginState } from '@/core/auth/actions';
import { TwoFactorMethod } from '@/core/auth/validation';

import { TextField } from '../forms/text-field';

type Method = (typeof TwoFactorMethod)[keyof typeof TwoFactorMethod];
const INITIAL: LoginState = { step: 'password', error: null, email: '', attempt: 0 };

/**
 * Email + password, then an optional TOTP / backup-code step. A server-action
 * form: it also works before hydration / without JavaScript (always POST).
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginFormAction, INITIAL);
  const [method, setMethod] = useState<Method>(TwoFactorMethod.Totp);

  const error = state.error ? (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  ) : null;

  if (state.step === 'two-factor') {
    return (
      <form action={formAction}>
        <input type="hidden" name="intent" value="two-factor" />
        <input type="hidden" name="method" value={method} />
        <input type="hidden" name="next" value={next ?? ''} />
        <FieldGroup>
          {error}
          <Field>
            <FieldLabel htmlFor="code">
              {method === TwoFactorMethod.Totp ? 'Authentication code' : 'Backup code'}
            </FieldLabel>
            {method === TwoFactorMethod.Totp ? (
              <InputOTP key={state.attempt} id="code" name="code" maxLength={6} autoFocus>
                <InputOTPGroup>
                  {Array.from({ length: 6 }, (_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            ) : (
              <Input
                key={state.attempt}
                id="code"
                name="code"
                autoComplete="one-time-code"
                autoFocus
              />
            )}
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : null}
            Verify
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() =>
              setMethod(
                method === TwoFactorMethod.Totp ? TwoFactorMethod.Backup : TwoFactorMethod.Totp,
              )
            }
          >
            {method === TwoFactorMethod.Totp ? 'Use a backup code' : 'Use the authenticator app'}
          </Button>
        </FieldGroup>
      </form>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="intent" value="password" />
      <input type="hidden" name="next" value={next ?? ''} />
      <FieldGroup>
        {error}
        <TextField
          name="email"
          type="email"
          label="Email"
          autoComplete="username"
          defaultValue={state.email}
          key={state.email}
          required
          autoFocus
        />
        <TextField
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          Sign in
        </Button>
      </FieldGroup>
    </form>
  );
}
