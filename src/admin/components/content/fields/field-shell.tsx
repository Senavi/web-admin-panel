'use client';

import { GlobeIcon, LanguagesIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFormState, type FieldErrors, type FieldValues } from 'react-hook-form';

import { Badge } from '@/admin/ui/badge';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/admin/ui/field';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/admin/ui/tooltip';

import { useEditor } from '../editor-context';

/** Collects nested RHF error messages under a path (lists, links, images…). */
export function errorsAt(
  errors: FieldErrors<FieldValues>,
  path: string,
): Array<{ message: string }> {
  let node: unknown = errors;
  for (const part of path.split('.')) {
    if (!node || typeof node !== 'object') return [];
    node = (node as Record<string, unknown>)[part];
  }
  const messages: Array<{ message: string }> = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message)
      messages.push({ message: record.message });
    for (const [key, child] of Object.entries(record))
      if (key !== 'ref' && key !== 'message') visit(child);
  };
  visit(node);
  return messages;
}

/**
 * Label, help text, "Shared across languages" / "Not translated yet" badges and
 * errors around one generated control.
 */
export function FieldShell({
  id,
  name,
  label,
  help,
  required,
  shared,
  contentPath,
  children,
  aside,
}: {
  id: string;
  /** RHF path (errors). */
  name: string;
  label: string;
  help?: string;
  required?: boolean;
  shared?: boolean;
  /** `section.field` path used for the inherited indicator (top-level fields only). */
  contentPath?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  const { errors } = useFormState();
  const { inherited, defaultLocale, locale } = useEditor();
  const fieldErrors = errorsAt(errors, name);
  const isInherited = contentPath ? inherited.has(contentPath) : false;

  return (
    <Field data-invalid={fieldErrors.length > 0 || undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <FieldLabel htmlFor={id}>
          {label}
          {required ? (
            <span aria-hidden className="text-destructive">
              *
            </span>
          ) : null}
        </FieldLabel>
        {shared ? (
          <Tooltip>
            <TooltipTrigger render={<Badge variant="secondary" className="gap-1" />}>
              <GlobeIcon aria-hidden />
              Shared across languages
            </TooltipTrigger>
            <TooltipContent>Changing it updates every language.</TooltipContent>
          </Tooltip>
        ) : null}
        {isInherited && !shared && locale !== defaultLocale ? (
          <Badge
            variant="outline"
            className="border-amber-500/50 text-amber-700 dark:text-amber-300 gap-1"
          >
            <LanguagesIcon aria-hidden />
            Not translated yet
          </Badge>
        ) : null}
        {aside ? <span className="ms-auto">{aside}</span> : null}
      </div>
      {children}
      {help ? <FieldDescription>{help}</FieldDescription> : null}
      <FieldError errors={fieldErrors} />
    </Field>
  );
}
