'use client';

import { Controller, useFormContext, useWatch } from 'react-hook-form';

import { CharCounter } from '@/admin/components/forms/char-counter';
import { SimpleSelect } from '@/admin/components/forms/simple-select';
import { Checkbox } from '@/admin/ui/checkbox';
import { Input } from '@/admin/ui/input';
import { Label } from '@/admin/ui/label';
import { Switch } from '@/admin/ui/switch';
import { Textarea } from '@/admin/ui/textarea';
import type {
  BooleanField,
  ColorField,
  LinkField,
  NumberField,
  SelectField,
  TextareaField,
  TextField,
} from '@/core/content/fields';

import { useEditor } from '../editor-context';
import { FieldShell } from './field-shell';
import { controlId, type FieldControlProps } from './types';

function Counter({ name, max }: { name: string; max?: number }) {
  const value: unknown = useWatch({ name });
  if (max === undefined) return null;
  return <CharCounter length={typeof value === 'string' ? value.length : 0} max={max} />;
}

export function TextControl({ name, field, label, contentPath }: FieldControlProps<TextField>) {
  const { register } = useFormContext();
  const { readOnly } = useEditor();
  const id = controlId(name);
  return (
    <FieldShell
      id={id}
      name={name}
      label={label}
      help={field.help}
      required={field.required}
      shared={!field.localized}
      contentPath={contentPath}
      aside={<Counter name={name} max={field.max} />}
    >
      <Input id={id} placeholder={field.placeholder} readOnly={readOnly} {...register(name)} />
    </FieldShell>
  );
}

export function TextareaControl({
  name,
  field,
  label,
  contentPath,
}: FieldControlProps<TextareaField>) {
  const { register } = useFormContext();
  const { readOnly } = useEditor();
  const id = controlId(name);
  return (
    <FieldShell
      id={id}
      name={name}
      label={label}
      help={field.help}
      required={field.required}
      shared={!field.localized}
      contentPath={contentPath}
      aside={<Counter name={name} max={field.max} />}
    >
      <Textarea id={id} rows={field.rows ?? 3} readOnly={readOnly} {...register(name)} />
    </FieldShell>
  );
}

export function NumberControl({ name, field, label, contentPath }: FieldControlProps<NumberField>) {
  const { register } = useFormContext();
  const { readOnly } = useEditor();
  const id = controlId(name);
  return (
    <FieldShell
      id={id}
      name={name}
      label={label}
      help={field.help}
      required={field.required}
      shared={!field.localized}
      contentPath={contentPath}
    >
      <Input
        id={id}
        type="number"
        inputMode={field.integer ? 'numeric' : 'decimal'}
        min={field.min}
        max={field.max}
        step={field.step ?? (field.integer ? 1 : 'any')}
        readOnly={readOnly}
        className="max-w-48"
        {...register(name, { valueAsNumber: true })}
      />
    </FieldShell>
  );
}

export function BooleanControl({
  name,
  field,
  label,
  contentPath,
}: FieldControlProps<BooleanField>) {
  const { readOnly } = useEditor();
  const id = controlId(name);
  return (
    <FieldShell
      id={id}
      name={name}
      label={label}
      help={field.help}
      shared={!field.localized}
      contentPath={contentPath}
    >
      <Controller
        name={name}
        render={({ field: control }) => (
          <Switch
            id={id}
            checked={Boolean(control.value)}
            onCheckedChange={(checked) => control.onChange(checked)}
            disabled={readOnly}
          />
        )}
      />
    </FieldShell>
  );
}

export function SelectControl({ name, field, label, contentPath }: FieldControlProps<SelectField>) {
  const { readOnly } = useEditor();
  const id = controlId(name);
  return (
    <FieldShell
      id={id}
      name={name}
      label={label}
      help={field.help}
      required={field.required}
      shared={!field.localized}
      contentPath={contentPath}
    >
      <Controller
        name={name}
        render={({ field: control }) => (
          <SimpleSelect
            id={id}
            value={String(control.value ?? '')}
            onChange={control.onChange}
            options={field.options}
            disabled={readOnly}
            className="max-w-64"
          />
        )}
      />
    </FieldShell>
  );
}

export function ColorControl({ name, field, label, contentPath }: FieldControlProps<ColorField>) {
  const { register } = useFormContext();
  const { readOnly } = useEditor();
  const value: unknown = useWatch({ name });
  const id = controlId(name);
  return (
    <FieldShell
      id={id}
      name={name}
      label={label}
      help={field.help}
      shared={!field.localized}
      contentPath={contentPath}
    >
      <div className="flex items-center gap-2">
        <Controller
          name={name}
          render={({ field: control }) => (
            <input
              type="color"
              aria-label={`${label} picker`}
              value={typeof control.value === 'string' ? control.value : '#000000'}
              onChange={(event) => control.onChange(event.target.value)}
              disabled={readOnly}
              className="size-9 cursor-pointer rounded-md border bg-transparent p-1"
            />
          )}
        />
        <Input id={id} className="max-w-32 font-mono" readOnly={readOnly} {...register(name)} />
        <span className="sr-only">{typeof value === 'string' ? value : ''}</span>
      </div>
    </FieldShell>
  );
}

export function LinkControl({ name, field, label, contentPath }: FieldControlProps<LinkField>) {
  const { register } = useFormContext();
  const { readOnly } = useEditor();
  const id = controlId(name);
  return (
    <FieldShell
      id={`${id}-label`}
      name={name}
      label={label}
      help={field.help}
      required={field.required}
      shared={!field.localized}
      contentPath={contentPath}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
        <Input
          id={`${id}-label`}
          placeholder="Label"
          aria-label={`${label}: label`}
          readOnly={readOnly}
          {...register(`${name}.label`)}
        />
        <Input
          id={`${id}-href`}
          placeholder="/about or https://…"
          aria-label={`${label}: URL`}
          readOnly={readOnly}
          {...register(`${name}.href`)}
        />
      </div>
      <Controller
        name={`${name}.external`}
        render={({ field: control }) => (
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${id}-external`}
              checked={Boolean(control.value)}
              onCheckedChange={(checked) => control.onChange(checked === true)}
              disabled={readOnly}
            />
            <Label htmlFor={`${id}-external`} className="font-normal">
              Open in a new tab (external link)
            </Label>
          </div>
        )}
      />
    </FieldShell>
  );
}
