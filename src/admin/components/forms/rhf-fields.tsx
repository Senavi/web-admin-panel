'use client';

import type { ReactNode } from 'react';
import { Controller, useFormContext, useFormState } from 'react-hook-form';

import { MediaPicker } from '@/admin/components/media/media-picker';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/admin/ui/field';
import { Input } from '@/admin/ui/input';
import { Switch } from '@/admin/ui/switch';
import { Textarea } from '@/admin/ui/textarea';
import type { MediaPreview } from '@/core/content/editor-types';

import { errorsAt } from '../content/fields/field-shell';
import { SimpleSelect, type SimpleOption } from './simple-select';

/** Small react-hook-form bound inputs for settings-style forms. */

function useFieldErrors(name: string) {
  const { errors } = useFormState();
  return errorsAt(errors, name);
}

function idFor(name: string) {
  return `setting-${name.replace(/[^a-zA-Z0-9]+/g, '-')}`;
}

function Shell({
  name,
  label,
  description,
  children,
}: {
  name: string;
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  const errors = useFieldErrors(name);
  return (
    <Field data-invalid={errors.length > 0 || undefined}>
      <FieldLabel htmlFor={idFor(name)}>{label}</FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={errors} />
    </Field>
  );
}

export function RhfText({
  name,
  label,
  description,
  type = 'text',
  placeholder,
}: {
  name: string;
  label: ReactNode;
  description?: ReactNode;
  type?: string;
  placeholder?: string;
}) {
  const { register } = useFormContext();
  return (
    <Shell name={name} label={label} description={description}>
      <Input id={idFor(name)} type={type} placeholder={placeholder} {...register(name)} />
    </Shell>
  );
}

export function RhfTextarea({
  name,
  label,
  description,
  rows = 3,
  placeholder,
}: {
  name: string;
  label: ReactNode;
  description?: ReactNode;
  rows?: number;
  placeholder?: string;
}) {
  const { register } = useFormContext();
  return (
    <Shell name={name} label={label} description={description}>
      <Textarea id={idFor(name)} rows={rows} placeholder={placeholder} {...register(name)} />
    </Shell>
  );
}

export function RhfNumber({
  name,
  label,
  description,
  min,
  max,
}: {
  name: string;
  label: ReactNode;
  description?: ReactNode;
  min?: number;
  max?: number;
}) {
  const { register } = useFormContext();
  return (
    <Shell name={name} label={label} description={description}>
      <Input
        id={idFor(name)}
        type="number"
        min={min}
        max={max}
        className="max-w-32"
        {...register(name, { valueAsNumber: true })}
      />
    </Shell>
  );
}

export function RhfSwitch({
  name,
  label,
  description,
}: {
  name: string;
  label: ReactNode;
  description?: ReactNode;
}) {
  const errors = useFieldErrors(name);
  return (
    <Field orientation="horizontal" data-invalid={errors.length > 0 || undefined}>
      <Controller
        name={name}
        render={({ field }) => (
          <Switch
            id={idFor(name)}
            checked={Boolean(field.value)}
            onCheckedChange={(checked) => field.onChange(checked)}
          />
        )}
      />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={idFor(name)}>{label}</FieldLabel>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
        <FieldError errors={errors} />
      </div>
    </Field>
  );
}

export function RhfSelect({
  name,
  label,
  description,
  options,
}: {
  name: string;
  label: ReactNode;
  description?: ReactNode;
  options: readonly SimpleOption[];
}) {
  return (
    <Shell name={name} label={label} description={description}>
      <Controller
        name={name}
        render={({ field }) => (
          <SimpleSelect
            id={idFor(name)}
            value={String(field.value ?? '')}
            onChange={field.onChange}
            options={options}
            className="max-w-64"
          />
        )}
      />
    </Shell>
  );
}

export function RhfColor({
  name,
  label,
  description,
}: {
  name: string;
  label: ReactNode;
  description?: ReactNode;
}) {
  const { register } = useFormContext();
  return (
    <Shell name={name} label={label} description={description}>
      <div className="flex items-center gap-2">
        <Controller
          name={name}
          render={({ field }) => (
            <input
              type="color"
              aria-label="Pick a color"
              value={typeof field.value === 'string' ? field.value : '#000000'}
              onChange={(event) => field.onChange(event.target.value)}
              className="size-9 cursor-pointer rounded-md border bg-transparent p-1"
            />
          )}
        />
        <Input id={idFor(name)} className="max-w-32 font-mono" {...register(name)} />
      </div>
    </Shell>
  );
}

export function RhfMedia({
  name,
  label,
  description,
  media,
  onUploaded,
  uploadUrl,
  accept,
}: {
  name: string;
  label: string;
  description?: ReactNode;
  media: Readonly<Record<string, MediaPreview>>;
  onUploaded: (preview: MediaPreview) => void;
  uploadUrl?: string;
  accept?: string;
}) {
  return (
    <Shell name={name} label={label} description={description}>
      <Controller
        name={name}
        render={({ field }) => {
          const mediaId = (field.value as string | null) ?? null;
          return (
            <MediaPicker
              id={idFor(name)}
              label={label}
              mediaId={mediaId}
              preview={mediaId ? media[mediaId] : undefined}
              onChange={field.onChange}
              onUploaded={onUploaded}
              uploadUrl={uploadUrl}
              accept={accept}
            />
          );
        }}
      />
    </Shell>
  );
}
