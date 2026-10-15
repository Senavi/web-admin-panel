'use client';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  GripVerticalIcon,
  ImageIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import {
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useFieldArray, useFormContext, useFormState, useWatch } from 'react-hook-form';

import { SimpleSelect } from '@/admin/components/forms/simple-select';
import { cn } from '@/admin/lib/utils';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/admin/ui/collapsible';
import { FieldError, FieldLabel } from '@/admin/ui/field';
import { Input } from '@/admin/ui/input';
import {
  type AnyField,
  fieldLabel,
  FieldKind,
  ListDisplay,
  listDisplay,
  type ListField,
  newListItemKey,
  type SelectField,
} from '@/core/content/fields';

import { useEditor } from '../editor-context';
import { FieldControl } from './field-control';
import { CompactFields, errorsAt } from './field-shell';
import { controlId, type FieldControlProps } from './types';

/**
 * Lists in four layouts (docs/CONTENT_SCHEMA.md § Lists), chosen by
 * `listDisplay()`: `tags` (chips), `lines` (stacked inputs), `rows` (one row
 * per item) and `cards` (collapsible cards). Only cards collapse. Every layout
 * supports min/max, per-item errors, drag to reorder and keyboard reordering.
 */

type Item = Record<string, unknown> & { _key: string };

function newItem(field: ListField, values: Record<string, unknown> = {}): Item {
  const item: Item = { _key: newListItemKey() };
  for (const [key, child] of Object.entries(field.of))
    item[key] = key in values ? values[key] : structuredClone(child.defaultValue);
  return item;
}

/** Key of the single item field (tags, lines). */
function singleKey(field: ListField): string {
  return Object.keys(field.of)[0] ?? 'value';
}

/** Splits pasted text into items: lines, or commas for tags. */
function splitPasted(text: string, commas: boolean): string[] {
  return text
    .split(commas ? /[\n,;]+/ : /\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function useList(name: string, field: ListField) {
  const { fields, append, insert, remove, move } = useFieldArray({ name, keyName: 'rhfId' });
  const { readOnly } = useEditor();
  const room = field.max === undefined ? Number.POSITIVE_INFINITY : field.max - fields.length;
  return {
    fields,
    append,
    insert,
    remove,
    move,
    canAdd: !readOnly && room > 0,
    canRemove: !readOnly && (field.min === undefined || fields.length > field.min),
    room,
    readOnly,
  };
}

type ListState = ReturnType<typeof useList>;

/** HTML drag and drop between items (the keyboard alternative is on each item). */
function useDragReorder(move: (from: number, to: number) => void) {
  const [dragging, setDragging] = useState<number | null>(null);
  return {
    dragging,
    handle: (index: number) => ({
      draggable: true,
      onDragStart: (event: DragEvent) => {
        setDragging(index);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      },
      onDragEnd: () => setDragging(null),
    }),
    target: (index: number) => ({
      onDragOver: (event: DragEvent) => {
        if (dragging !== null) event.preventDefault();
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        if (dragging !== null && dragging !== index) move(dragging, index);
        setDragging(null);
      },
    }),
  };
}

function ListHeader({
  field,
  label,
  count,
  id,
}: {
  field: ListField;
  label: string;
  count: number;
  id?: string;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Badge variant="secondary">
          {count}
          {field.max !== undefined ? ` / ${field.max}` : ''}
        </Badge>
        {!field.localized ? <Badge variant="secondary">Same in all languages</Badge> : null}
      </div>
      {field.help ? <p className="text-sm text-muted-foreground">{field.help}</p> : null}
    </>
  );
}

/** List-level errors (min/max) and, for tags, item errors. */
function ListErrors({ name, count }: { name: string; count: number }) {
  const { errors } = useFormState();
  const own = errorsAt(errors, name);
  return <FieldError errors={count === 0 ? own : errorsAt(errors, `${name}.root`)} />;
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div>
      <Button type="button" variant="outline" size="sm" onClick={onClick}>
        <PlusIcon />
        {label}
      </Button>
    </div>
  );
}

/** Up/down/remove buttons (keyboard and screen-reader alternative to dragging). */
function ItemButtons({
  index,
  count,
  name,
  list,
}: {
  index: number;
  count: number;
  name: string;
  list: ListState;
}) {
  if (list.readOnly) return null;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${name} up`}
        disabled={index === 0}
        onClick={() => list.move(index, index - 1)}
      >
        <ArrowUpIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${name} down`}
        disabled={index === count - 1}
        onClick={() => list.move(index, index + 1)}
      >
        <ArrowDownIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${name}`}
        disabled={!list.canRemove}
        onClick={() => list.remove(index)}
      >
        <Trash2Icon />
      </Button>
    </>
  );
}

// ── tags ─────────────────────────────────────────────────────────────────────

function TagsList({ name, field, label }: FieldControlProps<ListField>) {
  const list = useList(name, field);
  const key = singleKey(field);
  const of = field.of[key] as AnyField;
  const values = (useWatch({ name }) as Item[] | undefined) ?? [];
  const { errors } = useFormState();
  const [draft, setDraft] = useState('');
  const chipRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const drag = useDragReorder(list.move);
  const inputId = controlId(name);
  const textOf = (item: Item | undefined) => (typeof item?.[key] === 'string' ? item[key] : '');
  const options = of.kind === FieldKind.Select ? (of as SelectField).options : null;
  const optionLabel = (value: string) =>
    options?.find((option) => option.value === value)?.label ?? value;

  const add = (texts: readonly string[]) => {
    const taken = new Set(values.map(textOf));
    const fresh = texts.filter((text) => text && !taken.has(text)).slice(0, list.room);
    if (fresh.length > 0) list.append(fresh.map((text) => newItem(field, { [key]: text })));
  };
  // Focus moves after the list re-renders (chips are re-created on change).
  const pendingFocus = useRef<number | 'input' | null>(null);
  const focusChip = (index: number | 'input') => {
    pendingFocus.current = index;
  };
  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    if (target === 'input') document.getElementById(inputId)?.focus();
    else chipRefs.current[target]?.focus();
    pendingFocus.current = null;
  }, [list.fields, inputId]);

  const onInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'Enter' || event.key === ',') && draft.trim()) {
      event.preventDefault();
      add([draft.trim()]);
      setDraft('');
    } else if (event.key === 'Enter') {
      event.preventDefault(); // never submit the editor from the tag input
    } else if (event.key === 'Backspace' && !draft && values.length > 0 && list.canRemove) {
      list.remove(values.length - 1);
    }
  };
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const parts = splitPasted(event.clipboardData.getData('text'), true);
    if (parts.length < 2) return;
    event.preventDefault();
    add(parts);
  };
  const onChipKey = (event: KeyboardEvent<HTMLSpanElement>, index: number) => {
    if (list.readOnly) return;
    if (event.altKey && event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      list.move(index, index - 1);
      focusChip(index - 1);
    } else if (event.altKey && event.key === 'ArrowRight' && index < values.length - 1) {
      event.preventDefault();
      list.move(index, index + 1);
      focusChip(index + 1);
    } else if (event.key === 'ArrowLeft' && index > 0) {
      chipRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight') {
      if (index < values.length - 1) chipRefs.current[index + 1]?.focus();
      else document.getElementById(inputId)?.focus();
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && list.canRemove) {
      event.preventDefault();
      list.remove(index);
      focusChip(values.length > 1 ? Math.max(0, index - 1) : 'input');
    }
  };
  const itemErrors = list.fields.flatMap((_, index) =>
    errorsAt(errors, `${name}.${index}`).map((error) => ({
      message: `“${textOf(values[index]) || index + 1}”: ${error.message}`,
    })),
  );

  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label} data-list-display="tags">
      <ListHeader field={field} label={label} count={values.length} id={inputId} />
      <div className="focus-within:ring-ring/50 flex flex-wrap items-center gap-1.5 rounded-md border bg-transparent p-1.5 focus-within:ring-2">
        <ul className="contents" aria-label={`${label}: ${values.length} items`}>
          {list.fields.map((item, index) => {
            const text = textOf(values[index]);
            const invalid = errorsAt(errors, `${name}.${index}`).length > 0;
            return (
              <li
                key={item.rhfId}
                {...drag.target(index)}
                className={cn(drag.dragging === index && 'opacity-50')}
              >
                <span
                  ref={(element) => {
                    chipRefs.current[index] = element;
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${optionLabel(text)} (${index + 1} of ${values.length}${invalid ? ', has an error' : ''}). Delete to remove, Alt+arrows to move.`}
                  onKeyDown={(event) => onChipKey(event, index)}
                  {...(list.readOnly ? {} : drag.handle(index))}
                  className={cn(
                    'text-sm bg-secondary focus-visible:ring-ring inline-flex cursor-grab items-center gap-1 rounded-full px-2.5 py-0.5 outline-none focus-visible:ring-2',
                    invalid && 'bg-destructive/15 text-destructive',
                  )}
                >
                  {optionLabel(text)}
                  {!list.readOnly ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={`Remove ${optionLabel(text)}`}
                      disabled={!list.canRemove}
                      onClick={() => list.remove(index)}
                      className="rounded-full p-0.5 hover:bg-background/60"
                    >
                      <XIcon className="size-3" />
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
        {options ? (
          list.canAdd ? (
            <SimpleSelect
              id={inputId}
              value=""
              onChange={(value) => value && add([value])}
              options={[
                { value: '', label: 'Add…' },
                ...options.filter(
                  (option) => !values.some((item) => textOf(item) === option.value),
                ),
              ]}
              ariaLabel={`Add to ${label}`}
              className="h-7 w-36"
            />
          ) : null
        ) : (
          <Input
            id={inputId}
            value={draft}
            disabled={!list.canAdd}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onInputKey}
            onPaste={onPaste}
            onBlur={() => {
              if (draft.trim()) {
                add([draft.trim()]);
                setDraft('');
              }
            }}
            placeholder={list.canAdd ? 'Type and press Enter' : 'Maximum reached'}
            aria-label={`Add to ${label}`}
            className="h-7 min-w-32 flex-1 border-0 shadow-none focus-visible:ring-0"
          />
        )}
      </div>
      <FieldError errors={itemErrors} />
      <ListErrors name={name} count={values.length} />
    </div>
  );
}

// ── lines ────────────────────────────────────────────────────────────────────

function LinesList({ name, field, label }: FieldControlProps<ListField>) {
  const list = useList(name, field);
  const key = singleKey(field);
  const { register, getValues, setValue } = useFormContext();
  const { errors } = useFormState();
  const drag = useDragReorder(list.move);
  const path = (index: number) => `${name}.${index}.${key}`;
  // Focus moves after the list re-renders (a new line's input exists only then).
  const pendingFocus = useRef<number | null>(null);
  const focusLine = (index: number) => {
    pendingFocus.current = index;
  };
  const lineId = (index: number) => `${controlId(name)}-line-${index}`;
  useEffect(() => {
    if (pendingFocus.current === null) return;
    document.getElementById(lineId(pendingFocus.current))?.focus();
    pendingFocus.current = null;
  });

  const onKey = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!list.canAdd) return;
      list.insert(index + 1, newItem(field, { [key]: '' }), { shouldFocus: false });
      focusLine(index + 1);
    } else if (event.key === 'Backspace' && event.currentTarget.value === '' && list.canRemove) {
      event.preventDefault();
      list.remove(index);
      if (index > 0) focusLine(index - 1);
    } else if (event.altKey && event.key === 'ArrowUp' && index > 0) {
      event.preventDefault();
      list.move(index, index - 1);
      focusLine(index - 1);
    } else if (event.altKey && event.key === 'ArrowDown' && index < list.fields.length - 1) {
      event.preventDefault();
      list.move(index, index + 1);
      focusLine(index + 1);
    }
  };
  const onPaste = (event: ClipboardEvent<HTMLInputElement>, index: number) => {
    const lines = splitPasted(event.clipboardData.getData('text'), false);
    if (lines.length < 2) return;
    event.preventDefault();
    const current = String(getValues(path(index)) ?? '');
    const [first = '', ...rest] = lines;
    if (!current) setValue(path(index), first, { shouldDirty: true });
    const toInsert = (current ? lines : rest).slice(0, list.room);
    if (toInsert.length > 0)
      list.insert(
        index + 1,
        toInsert.map((text) => newItem(field, { [key]: text })),
        { shouldFocus: false },
      );
  };

  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label} data-list-display="lines">
      <ListHeader field={field} label={label} count={list.fields.length} />
      <ol className="flex flex-col gap-1.5">
        {list.fields.map((item, index) => {
          const itemErrors = errorsAt(errors, `${name}.${index}`);
          return (
            <li
              key={item.rhfId}
              {...drag.target(index)}
              className={cn('flex flex-col gap-1', drag.dragging === index && 'opacity-50')}
            >
              <div className="flex items-center gap-1">
                {!list.readOnly ? (
                  <span
                    {...drag.handle(index)}
                    aria-hidden
                    className="cursor-grab text-muted-foreground"
                  >
                    <GripVerticalIcon className="size-4" />
                  </span>
                ) : null}
                <Input
                  {...register(path(index))}
                  id={lineId(index)}
                  readOnly={list.readOnly}
                  aria-label={`${label} ${index + 1}`}
                  aria-invalid={itemErrors.length > 0 || undefined}
                  onKeyDown={(event) => onKey(event, index)}
                  onPaste={(event) => onPaste(event, index)}
                />
                {!list.readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${label} ${index + 1}`}
                    disabled={!list.canRemove}
                    onClick={() => list.remove(index)}
                  >
                    <XIcon />
                  </Button>
                ) : null}
              </div>
              <FieldError errors={itemErrors} />
            </li>
          );
        })}
      </ol>
      {list.canAdd ? (
        <AddButton
          label="Add"
          onClick={() => {
            list.append(newItem(field, { [key]: '' }), { shouldFocus: false });
            focusLine(list.fields.length);
          }}
        />
      ) : null}
      {!list.readOnly ? (
        <p className="text-xs text-muted-foreground">
          Enter adds a line, Backspace on an empty line removes it, Alt+↑/↓ moves it. Paste several
          lines to add them all.
        </p>
      ) : null}
      <ListErrors name={name} count={list.fields.length} />
    </div>
  );
}

// ── rows ─────────────────────────────────────────────────────────────────────

function RowsList({ name, field, label }: FieldControlProps<ListField>) {
  const list = useList(name, field);
  const drag = useDragReorder(list.move);
  const columns = Object.entries(field.of);

  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label} data-list-display="rows">
      <ListHeader field={field} label={label} count={list.fields.length} />
      {list.fields.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="text-sm w-full">
            <thead>
              <tr className="border-b text-muted-foreground">
                {!list.readOnly ? <th className="w-6" aria-hidden /> : null}
                {columns.map(([key, child]) => (
                  <th key={key} scope="col" className="font-medium p-2 text-start">
                    {fieldLabel(key, child)}
                  </th>
                ))}
                {!list.readOnly ? (
                  <th className="w-24">
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              <CompactFields value>
                {list.fields.map((item, index) => (
                  <tr
                    key={item.rhfId}
                    {...drag.target(index)}
                    className={cn(
                      'border-b last:border-0',
                      drag.dragging === index && 'opacity-50',
                    )}
                  >
                    {!list.readOnly ? (
                      <td className="ps-2 align-top">
                        <span
                          {...drag.handle(index)}
                          aria-hidden
                          className="mt-2 inline-block cursor-grab text-muted-foreground"
                        >
                          <GripVerticalIcon className="size-4" />
                        </span>
                      </td>
                    ) : null}
                    {columns.map(([key, child]) => (
                      <td key={key} className="p-1.5 align-top">
                        <FieldControl
                          name={`${name}.${index}.${key}`}
                          field={child}
                          label={`${fieldLabel(key, child)} ${index + 1}`}
                        />
                      </td>
                    ))}
                    {!list.readOnly ? (
                      <td className="p-1 align-top whitespace-nowrap">
                        <ItemButtons
                          index={index}
                          count={list.fields.length}
                          name={`row ${index + 1}`}
                          list={list}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </CompactFields>
            </tbody>
          </table>
        </div>
      ) : null}
      {list.canAdd ? (
        <AddButton label="Add row" onClick={() => list.append(newItem(field))} />
      ) : null}
      <ListErrors name={name} count={list.fields.length} />
    </div>
  );
}

// ── cards ────────────────────────────────────────────────────────────────────

function CardPreview({ name, field, index }: { name: string; field: ListField; index: number }) {
  const imageKey = Object.entries(field.of).find(
    ([, child]) => child.kind === FieldKind.Image,
  )?.[0];
  const title: unknown = useWatch({
    name: field.itemLabelField ? `${name}.${index}.${field.itemLabelField}` : `${name}.__none`,
  });
  const image: unknown = useWatch({
    name: imageKey ? `${name}.${index}.${imageKey}` : `${name}.__none`,
  });
  const { media } = useEditor();
  const mediaId =
    image && typeof image === 'object' && 'mediaId' in image
      ? (image.mediaId as string | null)
      : null;
  const preview = mediaId ? media[mediaId] : undefined;
  const text = typeof title === 'string' && title.trim() ? title : `Item ${index + 1}`;
  return (
    <span className="flex min-w-0 items-center gap-2">
      {imageKey ? (
        preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of an uploaded image
          <img src={preview.src} alt="" className="rounded size-8 shrink-0 object-cover" />
        ) : (
          <span className="rounded bg-muted flex size-8 shrink-0 items-center justify-center">
            <ImageIcon aria-hidden className="size-4 text-muted-foreground" />
          </span>
        )
      ) : null}
      <span className="truncate">{text}</span>
    </span>
  );
}

function CardsList({ name, field, label }: FieldControlProps<ListField>) {
  const list = useList(name, field);
  const drag = useDragReorder(list.move);
  // Collapsed by default; a new item opens.
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const { errors } = useFormState();
  const toggle = (key: string, next: boolean) =>
    setOpen((current) => {
      const copy = new Set(current);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
  const values = (useWatch({ name }) as Item[] | undefined) ?? [];

  return (
    <div className="flex flex-col gap-3" role="group" aria-label={label} data-list-display="cards">
      <ListHeader field={field} label={label} count={list.fields.length} />
      <ol className="flex flex-col gap-2">
        {list.fields.map((item, index) => {
          const key = values[index]?._key ?? item.rhfId;
          const invalid = errorsAt(errors, `${name}.${index}`).length > 0;
          return (
            <li
              key={item.rhfId}
              {...drag.target(index)}
              className={cn(drag.dragging === index && 'opacity-50')}
            >
              <Collapsible
                open={open.has(key) || invalid}
                onOpenChange={(next) => toggle(key, next)}
                className={cn('rounded-md border', invalid && 'border-destructive')}
              >
                <div className="flex items-center gap-1 p-1 ps-2">
                  {!list.readOnly ? (
                    <span
                      {...drag.handle(index)}
                      aria-hidden
                      className="cursor-grab text-muted-foreground"
                    >
                      <GripVerticalIcon className="size-4" />
                    </span>
                  ) : null}
                  <CollapsibleTrigger className="text-sm font-medium hover:bg-muted flex min-w-0 flex-1 items-center gap-2 rounded-sm p-1 text-start [&[data-panel-open]>svg]:rotate-180">
                    <ChevronDownIcon aria-hidden className="size-4 shrink-0 transition-transform" />
                    <CardPreview name={name} field={field} index={index} />
                  </CollapsibleTrigger>
                  <ItemButtons
                    index={index}
                    count={list.fields.length}
                    name={`item ${index + 1}`}
                    list={list}
                  />
                </div>
                <CollapsibleContent className="flex flex-col gap-4 border-t p-3">
                  {Object.entries(field.of).map(([childKey, child]) => (
                    <FieldControl
                      key={childKey}
                      name={`${name}.${index}.${childKey}`}
                      field={child}
                      label={fieldLabel(childKey, child)}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </li>
          );
        })}
      </ol>
      {list.canAdd ? (
        <AddButton
          label="Add item"
          onClick={() => {
            const next = newItem(field);
            toggle(next._key, true);
            list.append(next);
          }}
        />
      ) : null}
      <ListErrors name={name} count={list.fields.length} />
    </div>
  );
}

const LIST_LAYOUTS = {
  [ListDisplay.Tags]: TagsList,
  [ListDisplay.Lines]: LinesList,
  [ListDisplay.Rows]: RowsList,
  [ListDisplay.Cards]: CardsList,
} as const;

/** Repeatable values in the layout `listDisplay()` picks for the item shape. */
export function ListControl(props: FieldControlProps<ListField>) {
  const Layout = LIST_LAYOUTS[listDisplay(props.field)];
  return <Layout {...props} />;
}
