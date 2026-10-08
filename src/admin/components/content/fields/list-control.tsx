'use client';

import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useFieldArray, useFormState, useWatch } from 'react-hook-form';

import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/admin/ui/collapsible';
import { FieldError, FieldLabel } from '@/admin/ui/field';
import { fieldLabel, type ListField, newListItemKey } from '@/core/content/fields';

import { useEditor } from '../editor-context';
import { FieldControl } from './field-control';
import { errorsAt } from './field-shell';
import { type FieldControlProps } from './types';

function newItem(field: ListField): Record<string, unknown> {
  const item: Record<string, unknown> = { _key: newListItemKey() };
  for (const [key, child] of Object.entries(field.of))
    item[key] = structuredClone(child.defaultValue);
  return item;
}

function ItemTitle({ name, field, index }: { name: string; field: ListField; index: number }) {
  const value: unknown = useWatch({
    name: field.itemLabelField ? `${name}.${index}.${field.itemLabelField}` : `${name}.__none`,
  });
  const text = typeof value === 'string' && value.trim() ? value : `Item ${index + 1}`;
  return <span className="truncate">{text}</span>;
}

/** Repeatable group: add, remove, reorder (keyboard-accessible buttons), collapsible items. */
export function ListControl({ name, field, label }: FieldControlProps<ListField>) {
  const { fields, append, remove, move } = useFieldArray({ name, keyName: 'rhfId' });
  const { errors } = useFormState();
  const { readOnly } = useEditor();
  const ownError = (() => {
    const node = errorsAt(errors, name);
    return node.length > 0 && fields.length === 0 ? node : errorsAt(errors, `${name}.root`);
  })();
  const canAdd = !readOnly && (field.max === undefined || fields.length < field.max);
  const canRemove = !readOnly && (field.min === undefined || fields.length > field.min);

  return (
    <div className="flex flex-col gap-3" role="group" aria-label={label}>
      <div className="flex flex-wrap items-center gap-2">
        <FieldLabel>{label}</FieldLabel>
        <Badge variant="secondary">
          {fields.length}
          {field.max !== undefined ? ` / ${field.max}` : ''}
        </Badge>
        {!field.localized ? <Badge variant="secondary">Shared across languages</Badge> : null}
      </div>
      {field.help ? <p className="text-sm text-muted-foreground">{field.help}</p> : null}
      <ol className="flex flex-col gap-2">
        {fields.map((item, index) => (
          <li key={item.rhfId}>
            <Collapsible defaultOpen={fields.length <= 3} className="rounded-md border">
              <div className="flex items-center gap-1 p-1 ps-2">
                <CollapsibleTrigger className="text-sm font-medium hover:bg-muted flex min-w-0 flex-1 items-center gap-2 rounded-sm p-1 text-start [&[data-panel-open]>svg]:rotate-180">
                  <ChevronDownIcon aria-hidden className="size-4 shrink-0 transition-transform" />
                  <ItemTitle name={name} field={field} index={index} />
                </CollapsibleTrigger>
                {!readOnly ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move item ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move item ${index + 1} down`}
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove item ${index + 1}`}
                      disabled={!canRemove}
                      onClick={() => remove(index)}
                    >
                      <Trash2Icon />
                    </Button>
                  </>
                ) : null}
              </div>
              <CollapsibleContent className="flex flex-col gap-4 border-t p-3">
                {Object.entries(field.of).map(([key, child]) => (
                  <FieldControl
                    key={key}
                    name={`${name}.${index}.${key}`}
                    field={child}
                    label={fieldLabel(key, child)}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          </li>
        ))}
      </ol>
      {canAdd ? (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => append(newItem(field))}>
            <PlusIcon />
            Add item
          </Button>
        </div>
      ) : null}
      <FieldError errors={ownError} />
    </div>
  );
}
