'use client';

import { useCallback, useState, useTransition } from 'react';
import { toast } from 'sonner';

import type { ActionResult, FieldErrors } from '@/core/actions/result';

interface UseActionOptions<TData> {
  /** Show a success toast with the action's message (default true). */
  readonly toastOnSuccess?: boolean;
  readonly onSuccess?: (data: TData) => void;
}

/**
 * Runs a server action in a transition, exposes pending state and field errors,
 * and shows toasts for success / failure.
 */
export function useAction<TInput, TData>(
  action: (input: TInput) => Promise<ActionResult<TData>>,
  options: UseActionOptions<TData> = {},
) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const { toastOnSuccess = true, onSuccess } = options;

  const run = useCallback(
    (input: TInput) =>
      new Promise<ActionResult<TData> | undefined>((resolve) => {
        startTransition(async () => {
          const result = await action(input);
          // `undefined` when the action redirected.
          if (!result) return resolve(undefined);
          if (result.ok) {
            setFieldErrors({});
            setError(null);
            if (toastOnSuccess && result.message) toast.success(result.message);
            onSuccess?.(result.data);
          } else {
            setFieldErrors(result.fieldErrors ?? {});
            setError(result.error);
            toast.error(result.error);
          }
          resolve(result);
        });
      }),
    [action, onSuccess, toastOnSuccess],
  );

  const errorsFor = useCallback(
    (field: string) => fieldErrors[field]?.map((message) => ({ message })),
    [fieldErrors],
  );

  return { run, pending, fieldErrors, errorsFor, error, setError };
}

/** Reads a form's entries as a plain object (string values). */
export function formToObject(form: HTMLFormElement): Record<string, string> {
  const result: Record<string, string> = {};
  new FormData(form).forEach((value, key) => {
    if (typeof value === 'string') result[key] = value;
  });
  return result;
}
