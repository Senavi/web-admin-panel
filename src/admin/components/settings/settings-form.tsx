'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  type DefaultValues,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useForm,
} from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { SectionCard } from '@/admin/components/layout/section-card';
import { useHydrated } from '@/admin/hooks/use-hydrated';
import { useUnsavedGuard } from '@/admin/hooks/use-unsaved-guard';
import { Button } from '@/admin/ui/button';
import { FieldGroup } from '@/admin/ui/field';
import type { ActionResult } from '@/core/actions/result';

/**
 * One independently saved settings group: RHF + Zod (same schema as the server
 * action), Save enabled only when dirty, server field errors mapped to inputs.
 */
export function SettingsForm<Schema extends z.ZodType<FieldValues, FieldValues>>({
  id,
  title,
  description,
  schema,
  defaultValues,
  onSave,
  beforeSave,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  schema: Schema;
  defaultValues: z.input<Schema>;
  onSave: (values: z.output<Schema>) => Promise<ActionResult<unknown>>;
  /** Return false to cancel (e.g. a confirmation dialog). */
  beforeSave?: (values: z.output<Schema>, initial: z.input<Schema>) => Promise<boolean>;
  children: ReactNode;
}) {
  const router = useRouter();
  const form = useForm<z.input<Schema>, unknown, z.output<Schema>>({
    defaultValues: defaultValues as DefaultValues<z.input<Schema>>,
    resolver: zodResolver(schema as never),
  });
  const { isDirty, isSubmitting } = form.formState;
  const hydrated = useHydrated();
  useUnsavedGuard(isDirty);

  const submit = form.handleSubmit(async (values) => {
    if (beforeSave && !(await beforeSave(values, defaultValues))) return;
    const result = await onSave(values);
    if (result.ok) {
      form.reset(values as z.input<Schema>);
      toast.success(result.message ?? 'Saved.');
      router.refresh();
      return;
    }
    for (const [path, messages] of Object.entries(result.fieldErrors ?? {})) {
      form.setError(path as FieldPath<z.input<Schema>>, { type: 'server', message: messages[0] });
    }
    toast.error(result.error);
  });

  return (
    <SectionCard id={id} title={title} description={description}>
      <FormProvider {...form}>
        <form
          method="post"
          noValidate
          onSubmit={(event) => void submit(event)}
          aria-label={title}
          data-hydrated={hydrated || undefined}
        >
          <FieldGroup>
            {children}
            <div className="flex justify-end">
              <Button type="submit" disabled={!isDirty || isSubmitting}>
                {isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
                Save
              </Button>
            </div>
          </FieldGroup>
        </form>
      </FormProvider>
    </SectionCard>
  );
}
