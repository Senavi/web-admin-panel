import type { ComponentProps, ReactNode } from 'react';

import { Field, FieldDescription, FieldError, FieldLabel } from '@/admin/ui/field';
import { Input } from '@/admin/ui/input';

interface TextFieldProps extends Omit<ComponentProps<typeof Input>, 'id'> {
  readonly name: string;
  readonly label: ReactNode;
  readonly description?: ReactNode;
  readonly errors?: Array<{ message?: string }>;
}

/** Labeled input with description and error message, wired for accessibility. */
export function TextField({ name, label, description, errors, ...inputProps }: TextFieldProps) {
  const id = `field-${name}`;
  const invalid = Boolean(errors?.length);
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} name={name} aria-invalid={invalid || undefined} {...inputProps} />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={errors} />
    </Field>
  );
}
