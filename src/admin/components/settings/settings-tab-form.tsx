'use client';

import { Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { type FieldPath, FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { useHydrated } from '@/admin/hooks/use-hydrated';
import { useUnsavedGuard } from '@/admin/hooks/use-unsaved-guard';
import { Button } from '@/admin/ui/button';
import { FieldGroup } from '@/admin/ui/field';
import { saveSettingsAction } from '@/core/settings/actions';

/** Values of one Settings tab: partial settings groups and per-language values. */
export interface SettingsTabValues {
  readonly groups: Record<string, Record<string, unknown>>;
  readonly localized?: Record<string, Record<string, unknown>>;
  /** Form-only values (e.g. switches that map onto stored fields in `toSave`). */
  readonly ui?: Record<string, unknown>;
}

/**
 * One Settings tab: a single form with one Save. While it has unsaved changes a
 * sticky bar offers Discard / Save changes. The server validates and maps field
 * errors back (`groups.<group>.<field>`, `localized.<locale>.<field>`).
 */
export function SettingsTabForm<V extends SettingsTabValues>({
  label,
  defaultValues,
  toSave = (values) => values,
  beforeSave,
  children,
}: {
  /** Accessible name of the form (the tab label). */
  label: string;
  defaultValues: V;
  /** Maps form values to what is saved (e.g. derived fields). */
  toSave?: (values: V, initial: V) => SettingsTabValues;
  /** Return false to cancel (e.g. a confirmation dialog). */
  beforeSave?: (values: V, initial: V) => Promise<boolean>;
  children: ReactNode;
}) {
  const router = useRouter();
  const form = useForm<V>({ defaultValues: defaultValues as never });
  const { isDirty, isSubmitting } = form.formState;
  const hydrated = useHydrated();
  useUnsavedGuard(isDirty);

  const submit = form.handleSubmit(async (values) => {
    if (beforeSave && !(await beforeSave(values, defaultValues))) return;
    const { groups, localized } = toSave(values, defaultValues);
    const result = await saveSettingsAction({ groups, localized: localized ?? {} });
    if (result.ok) {
      form.reset(values);
      toast.success(result.message ?? 'Saved.');
      router.refresh();
      return;
    }
    for (const [path, messages] of Object.entries(result.fieldErrors ?? {})) {
      form.setError(path as FieldPath<V>, { type: 'server', message: messages[0] });
    }
    toast.error(result.error);
  });

  return (
    <FormProvider {...form}>
      <form
        method="post"
        noValidate
        onSubmit={(event) => void submit(event)}
        aria-label={label}
        data-hydrated={hydrated || undefined}
        className="flex flex-col gap-6"
      >
        <FieldGroup>{children}</FieldGroup>
        {isDirty ? (
          <div
            role="region"
            aria-label="Unsaved changes"
            className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6"
          >
            <p className="text-sm font-medium">You have unsaved changes</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => form.reset()}
              >
                Discard
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          </div>
        ) : null}
      </form>
    </FormProvider>
  );
}
