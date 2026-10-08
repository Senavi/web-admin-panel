'use client';

import { useState, type FormEvent } from 'react';

import { formToObject, useAction } from '@/admin/hooks/use-action';
import { Alert, AlertDescription } from '@/admin/ui/alert';
import { Button } from '@/admin/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/admin/ui/field';
import { Input } from '@/admin/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/admin/ui/input-otp';
import { Spinner } from '@/admin/ui/spinner';
import { loginAction, verifyTwoFactorAction } from '@/core/auth/actions';
import { TwoFactorMethod } from '@/core/auth/validation';

import { TextField } from '../forms/text-field';

type Step = 'password' | 'two-factor';
type Method = (typeof TwoFactorMethod)[keyof typeof TwoFactorMethod];

/** Email + password, then an optional TOTP / backup-code step. */
export function LoginForm({ next }: { next?: string }) {
  const [step, setStep] = useState<Step>('password');
  const [method, setMethod] = useState<Method>(TwoFactorMethod.Totp);
  const [code, setCode] = useState('');

  const login = useAction(loginAction, {
    toastOnSuccess: false,
    onSuccess: (data) => {
      if (data.step === 'two-factor') setStep('two-factor');
    },
  });
  const verify = useAction(verifyTwoFactorAction, { toastOnSuccess: false });

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void login.run({ ...formToObject(event.currentTarget), next });
  };

  const submitCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void verify.run({ code, method, next }).then((result) => {
      if (result && !result.ok) setCode('');
    });
  };

  if (step === 'two-factor') {
    return (
      <form onSubmit={submitCode} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="code">
              {method === TwoFactorMethod.Totp ? 'Authentication code' : 'Backup code'}
            </FieldLabel>
            {method === TwoFactorMethod.Totp ? (
              <InputOTP id="code" maxLength={6} value={code} onChange={setCode} autoFocus>
                <InputOTPGroup>
                  {Array.from({ length: 6 }, (_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            ) : (
              <Input
                id="code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="one-time-code"
                autoFocus
              />
            )}
            <FieldError>{verify.error}</FieldError>
          </Field>
          <Button type="submit" disabled={verify.pending}>
            {verify.pending ? <Spinner /> : null}
            Verify
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => {
              setCode('');
              setMethod(
                method === TwoFactorMethod.Totp ? TwoFactorMethod.Backup : TwoFactorMethod.Totp,
              );
            }}
          >
            {method === TwoFactorMethod.Totp ? 'Use a backup code' : 'Use the authenticator app'}
          </Button>
        </FieldGroup>
      </form>
    );
  }

  return (
    <form onSubmit={submitPassword} noValidate>
      <FieldGroup>
        {login.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{login.error}</AlertDescription>
          </Alert>
        ) : null}
        <TextField
          name="email"
          type="email"
          label="Email"
          autoComplete="username"
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
        <Button type="submit" disabled={login.pending}>
          {login.pending ? <Spinner /> : null}
          Sign in
        </Button>
      </FieldGroup>
    </form>
  );
}
