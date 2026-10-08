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
  | ColorField;

export type ListItemFields = Readonly<Record<string, ScalarField>>;

/** Stable `_key` lets editors reorder items without losing identity. */
export type ListItem<I extends ListItemFields> = { readonly _key: string } & {
  readonly [K in keyof I]: StoredValue<I[K]>;
};

export interface ListField<I extends ListItemFields = ListItemFields> extends FieldBase<
  'list',
  ListItem<I>[]
> {
  readonly of: I;
  readonly min?: number;
  readonly max?: number;
  /** Item field used as the item title in the editor. */
  readonly itemLabelField?: keyof I & string;
}

export type AnyField = ScalarField | ListField;
export type FieldMap = Readonly<Record<string, AnyField>>;

/** Value stored in the database and edited in the admin. */
export type StoredValue<F> = F extends FieldBase<FieldKind, infer V> ? V : never;

// ── Builders ───────────────────────────────────────────────────────────────

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

  list: <const I extends ListItemFields>(
    options: Omit<CommonOptions<ListItem<I>[]>, 'default'> & {
      readonly of: I;
      readonly min?: number;
      readonly max?: number;
      readonly itemLabelField?: keyof I & string;
    },
  ): ListField<I> => ({
    ...base<'list', ListItem<I>[]>(FieldKind.List, options, []),
    of: options.of,
    ...(options.min !== undefined ? { min: options.min } : {}),
    ...(options.max !== undefined ? { max: options.max } : {}),
    ...(options.itemLabelField ? { itemLabelField: options.itemLabelField } : {}),
  }),
} as const;

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
