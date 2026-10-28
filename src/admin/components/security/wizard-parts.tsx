'use client';

import { CheckIcon, Loader2Icon, XCircleIcon } from 'lucide-react';

/** Shared pieces of the Connect wizards (Neon, Supabase). */

const SECRET_BYTES = 32;

export type TaskState = 'idle' | 'running' | 'done' | 'failed';

/** A random secret (base64url), generated in the browser for the hosting variables. */
export function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** A secret value as shown on screen (copied in full). */
export function mask(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) {
      url.password = '****';
      return url.toString();
    }
  } catch {
    // Not a URL.
  }
  return value.length <= 8 ? '••••' : `••••${value.slice(-4)}`;
}

export function TaskIcon({ state, index }: { state: TaskState; index: number }) {
  if (state === 'running')
    return <Loader2Icon className="size-4 animate-spin" aria-label="In progress" />;
  if (state === 'done')
    return (
      <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-label="Done" />
    );
  if (state === 'failed')
    return <XCircleIcon className="size-4 text-destructive" aria-label="Failed" />;
  return (
    <span className="w-4 text-center text-xs text-muted-foreground" aria-hidden>
      {index + 1}
    </span>
  );
}
