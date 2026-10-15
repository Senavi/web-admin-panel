import type { RichTextDoc } from './rich-text';
import { EMPTY_RICH_TEXT } from './rich-text';

/**
 * Content field builders (`f.text()`, `f.image()`, …). A field is a plain,
 * serializable descriptor. TypeScript types, Zod validators, admin form
 * controls and storage splitting are all derived from it. See
 * docs/CONTENT_SCHEMA.md.
 */

export const FieldKind = {
  Text: 'text',
  Textarea: 'textarea',
  RichText: 'richText',
  Image: 'image',
  Link: 'link',
  List: 'list',
  Boolean: 'boolean',
  Number: 'number',
  Select: 'select',
  Color: 'color',
  Email: 'email',
  Phone: 'phone',
} as const;
export type FieldKind = (typeof FieldKind)[keyof typeof FieldKind];

export interface FieldBase<K extends FieldKind, V> {
  readonly kind: K;
  /** Admin label. Empty → derived from the field key. */
  readonly label: string;
  /** Help text shown under the control. */
  readonly help?: string;
  readonly required: boolean;
  /** Localized values differ per locale; shared values are "Shared across languages". */
  readonly localized: boolean;
  readonly defaultValue: V;
  /** Phantom property carrying the value type; never set at runtime. */
  readonly __value?: V;
}

export interface ImageValue {
  readonly mediaId: string | null;
  /** Alt text is always per locale, even when the image itself is shared. */
  readonly alt: string;
}

export interface LinkValue {
  readonly label: string;
  readonly href: string;
  readonly external: boolean;
}

export interface SelectOption<V extends string = string> {
  readonly value: V;
  readonly label: string;
}

export interface TextField extends FieldBase<'text', string> {
  readonly min?: number;
  readonly max?: number;
  readonly placeholder?: string;
}
export interface TextareaField extends FieldBase<'textarea', string> {
  readonly max?: number;
  readonly rows?: number;
}
export interface RichTextField extends FieldBase<'richText', RichTextDoc> {
  /** Max plain-text characters. */
  readonly max?: number;
}
export interface ImageField extends FieldBase<'image', ImageValue> {
  /** Hint for editors, e.g. "1600×900, landscape". */
  readonly recommendedSize?: string;
}
export type LinkField = FieldBase<'link', LinkValue>;
export type BooleanField = FieldBase<'boolean', boolean>;
export interface NumberField extends FieldBase<'number', number> {
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly integer: boolean;
}
export interface SelectField<V extends string = string> extends FieldBase<'select', V> {
  readonly options: readonly SelectOption<V>[];
}
export type ColorField = FieldBase<'color', string>;
/** Validated email address (render with `mailtoHref`). */
export interface EmailField extends FieldBase<'email', string> {
  readonly placeholder?: string;
}
/** Validated phone number (render with `telHref`). */
export interface PhoneField extends FieldBase<'phone', string> {
  readonly placeholder?: string;
}

/** Fields allowed inside list items (no nested lists). */
export type ScalarField =
  | TextField
  | TextareaField
  | RichTextField
  | ImageField
  | LinkField
  | BooleanField
  | NumberField
  | SelectField
  | ColorField
  | EmailField
  | PhoneField;

export type ListItemFields = Readonly<Record<string, ScalarField>>;

/** Stable `_key` lets editors reorder items without losing identity. */
export type ListItem<I extends ListItemFields> = { readonly _key: string } & {
  readonly [K in keyof I]: StoredValue<I[K]>;
};

/**
 * How a list is edited (docs/CONTENT_SCHEMA.md § Lists). Chosen automatically
 * from the item shape when not set (`listDisplay()`):
 * - `tags`: chips for one short text/select value per item;
 * - `lines`: stacked inputs for one text value per item;
 * - `rows`: table-like rows for 2–3 short scalar fields;
 * - `cards`: collapsible cards for anything bigger (images, rich text, > 3 fields).
 */
export const ListDisplay = {
  Tags: 'tags',
  Lines: 'lines',
  Rows: 'rows',
  Cards: 'cards',
} as const;
export type ListDisplay = (typeof ListDisplay)[keyof typeof ListDisplay];

/** Item key of a scalar list's value (`f.list({ of: f.text() })` stores `{ _key, value }`). */
export const SCALAR_ITEM_KEY = 'value';

export interface ListField<I extends ListItemFields = ListItemFields> extends FieldBase<
  'list',
  ListItem<I>[]
> {
  readonly of: I;
  readonly min?: number;
  readonly max?: number;
  /** Item field used as the item title in the editor. */
  readonly itemLabelField?: keyof I & string;
  /** Editor layout; automatic when omitted (see `ListDisplay`). */
  readonly display?: ListDisplay;
  /**
   * A list of plain values (`f.list({ of: f.text() })`): items are stored as
   * `{ _key, value }` and the site receives `value[]`.
   */
  readonly scalar?: boolean;
}

/** A list of plain values: the site receives an array of the item field's value. */
export interface ScalarListField<S extends ScalarField = ScalarField> extends ListField<{
  readonly value: S;
}> {
  readonly scalar: true;
}

export type AnyField = ScalarField | ListField;
export type FieldMap = Readonly<Record<string, AnyField>>;

/** Value stored in the database and edited in the admin. */
export type StoredValue<F> = F extends FieldBase<FieldKind, infer V> ? V : never;

// ── Builders ───────────────────────────────────────────────────────────────

interface ListOptionsBase {
  readonly label?: string;
  readonly help?: string;
  readonly required?: boolean;
  readonly localized?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly display?: ListDisplay;
}

function isFieldDescriptor(value: object): value is ScalarField {
  return typeof (value as { kind?: unknown }).kind === 'string';
}

/**
 * Repeatable values. `of` is either one field (a list of plain values: tags,
 * bullet points) or a map of fields (a list of objects: cards, rows).
 */
function list<const S extends ScalarField>(
  options: ListOptionsBase & { readonly of: S },
): ScalarListField<S>;
function list<const I extends ListItemFields>(
  options: ListOptionsBase & { readonly of: I; readonly itemLabelField?: keyof I & string },
): ListField<I>;
function list(
  options: ListOptionsBase & {
    readonly of: ScalarField | ListItemFields;
    readonly itemLabelField?: string;
  },
): ListField | ScalarListField {
  const scalar = isFieldDescriptor(options.of);
  const of: ListItemFields = scalar
    ? { [SCALAR_ITEM_KEY]: options.of as ScalarField }
    : (options.of as ListItemFields);
  const field: ListField = {
    ...base<'list', ListItem<ListItemFields>[]>(FieldKind.List, options, []),
    of,
    ...(options.min !== undefined ? { min: options.min } : {}),
    ...(options.max !== undefined ? { max: options.max } : {}),
    ...(scalar
      ? { scalar: true, itemLabelField: SCALAR_ITEM_KEY }
      : options.itemLabelField
        ? { itemLabelField: options.itemLabelField }
        : {}),
    ...(options.display ? { display: options.display } : {}),
  };
  assertDisplayFits(field);
  return field;
}

interface CommonOptions<V> {
  readonly label?: string;
  readonly help?: string;
  readonly required?: boolean;
  /** Default `true`. Set `false` for values shared across all languages. */
  readonly localized?: boolean;
  readonly default?: V;
}

function base<K extends FieldKind, V>(
  kind: K,
  options: CommonOptions<V>,
  fallback: V,
): FieldBase<K, V> {
  return {
    kind,
    label: options.label ?? '',
    ...(options.help ? { help: options.help } : {}),
    required: options.required ?? false,
    localized: options.localized ?? true,
    defaultValue: options.default ?? fallback,
  };
}

export const f = {
  text: (
    options: CommonOptions<string> & Pick<TextField, 'min' | 'max' | 'placeholder'> = {},
  ): TextField => ({
    ...base(FieldKind.Text, options, ''),
    ...(options.min !== undefined ? { min: options.min } : {}),
    ...(options.max !== undefined ? { max: options.max } : {}),
    ...(options.placeholder ? { placeholder: options.placeholder } : {}),
  }),

  textarea: (
    options: CommonOptions<string> & Pick<TextareaField, 'max' | 'rows'> = {},
  ): TextareaField => ({
    ...base(FieldKind.Textarea, options, ''),
    ...(options.max !== undefined ? { max: options.max } : {}),
    ...(options.rows !== undefined ? { rows: options.rows } : {}),
  }),

  richText: (
    options: CommonOptions<RichTextDoc> & Pick<RichTextField, 'max'> = {},
  ): RichTextField => ({
    ...base(FieldKind.RichText, options, EMPTY_RICH_TEXT),
    ...(options.max !== undefined ? { max: options.max } : {}),
  }),

  image: (
    options: Omit<CommonOptions<ImageValue>, 'default'> & Pick<ImageField, 'recommendedSize'> = {},
  ): ImageField => ({
    ...base<'image', ImageValue>(FieldKind.Image, options, { mediaId: null, alt: '' }),
    ...(options.recommendedSize ? { recommendedSize: options.recommendedSize } : {}),
  }),

  link: (options: CommonOptions<LinkValue> = {}): LinkField =>
    base(FieldKind.Link, options, { label: '', href: '', external: false }),

  boolean: (options: CommonOptions<boolean> = {}): BooleanField =>
    base(FieldKind.Boolean, options, false),

  number: (
    options: CommonOptions<number> &
      Partial<Pick<NumberField, 'min' | 'max' | 'step' | 'integer'>> = {},
  ): NumberField => ({
    ...base(FieldKind.Number, options, options.min ?? 0),
    integer: options.integer ?? false,
    ...(options.min !== undefined ? { min: options.min } : {}),
    ...(options.max !== undefined ? { max: options.max } : {}),
    ...(options.step !== undefined ? { step: options.step } : {}),
  }),

  select: <const V extends string>(
    options: CommonOptions<NoInfer<V>> & { readonly options: readonly SelectOption<V>[] },
  ): SelectField<V> => {
    const first = options.options[0];
    if (!first) throw new Error('f.select() needs at least one option.');
    return {
      ...base<'select', V>(FieldKind.Select, options, first.value),
      options: options.options,
    };
  },

  color: (options: CommonOptions<string> = {}): ColorField =>
    base(FieldKind.Color, options, '#000000'),

  email: (options: CommonOptions<string> & Pick<EmailField, 'placeholder'> = {}): EmailField => ({
    ...base(FieldKind.Email, options, ''),
    ...(options.placeholder ? { placeholder: options.placeholder } : {}),
  }),

  phone: (options: CommonOptions<string> & Pick<PhoneField, 'placeholder'> = {}): PhoneField => ({
    ...base(FieldKind.Phone, options, ''),
    ...(options.placeholder ? { placeholder: options.placeholder } : {}),
  }),

  list,
} as const;

// ── List display ───────────────────────────────────────────────────────────

/** Item fields that fit in one line (rows / tags / lines). */
const INLINE_KINDS: ReadonlySet<FieldKind> = new Set([
  FieldKind.Text,
  FieldKind.Number,
  FieldKind.Select,
  FieldKind.Link,
  FieldKind.Boolean,
  FieldKind.Email,
  FieldKind.Phone,
  FieldKind.Color,
]);
/** A text up to this length is a tag (chip). */
export const TAG_MAX_LENGTH = 40;
/** A text up to this length is one line of a `lines` list. */
export const LINE_MAX_LENGTH = 120;
const ROWS_MAX_FIELDS = 3;

/** The editor layout of a list: `display` if set, otherwise chosen from the item shape. */
export function listDisplay(field: {
  readonly display?: ListDisplay;
  readonly of: ListItemFields;
}): ListDisplay {
  if (field.display) return field.display;
  const items = Object.values(field.of);
  if (items.length === 1 && items[0]) {
    const only = items[0];
    if (only.kind === FieldKind.Select) return ListDisplay.Tags;
    if (only.kind === FieldKind.Text) {
      const max = only.max ?? LINE_MAX_LENGTH;
      if (max <= TAG_MAX_LENGTH) return ListDisplay.Tags;
      if (max <= LINE_MAX_LENGTH) return ListDisplay.Lines;
    }
  }
  if (items.length <= ROWS_MAX_FIELDS && items.every((item) => INLINE_KINDS.has(item.kind)))
    return ListDisplay.Rows;
  return ListDisplay.Cards;
}

/** Throws at definition time when an explicit `display` can't show the item shape. */
function assertDisplayFits(field: ListField): void {
  const items = Object.values(field.of);
  const single = items.length === 1 ? items[0] : undefined;
  const fail = (reason: string) => {
    throw new Error(`f.list({ display: '${field.display}' }): ${reason}`);
  };
  switch (field.display) {
    case ListDisplay.Tags:
      if (!single || (single.kind !== FieldKind.Text && single.kind !== FieldKind.Select))
        fail('items must be one text or select field.');
      break;
    case ListDisplay.Lines:
      if (!single || single.kind !== FieldKind.Text) fail('items must be one text field.');
      break;
    case ListDisplay.Rows:
      if (items.length > ROWS_MAX_FIELDS || !items.every((item) => INLINE_KINDS.has(item.kind)))
        fail(
          `items must be at most ${ROWS_MAX_FIELDS} short fields (text, number, select, link…).`,
        );
      break;
    case ListDisplay.Cards:
    case undefined:
      break;
  }
}

/** "heroImage" → "Hero image" (fallback label). */
export function humanizeKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function fieldLabel(key: string, field: AnyField): string {
  return field.label || humanizeKey(key);
}

/** Random stable key for new list items. */
export function newListItemKey(): string {
  return crypto.randomUUID().slice(0, 8);
}
