import type { ProjectLocale } from '@project/config';

import type { ContentSchema, SectionDefinition } from '@/core/content/define';
import { type AnyField, f, humanizeKey } from '@/core/content/fields';

/**
 * Forms: fields are fixed in code (`defineForm`), their visible copy (labels,
 * placeholders, help, option labels, consent text, submit label and success
 * message) is editable per locale in Pages → Forms → Texts. Submissions are
 * stored, delivered (email, webhook, Telegram) and listed in the inbox.
 * See docs/CONTENT_SCHEMA.md § Forms. Client-safe (no server imports).
 */

export const FormFieldType = {
  Text: 'text',
  Email: 'email',
  Tel: 'tel',
  Textarea: 'textarea',
  Select: 'select',
  Checkbox: 'checkbox',
  /** Required agreement (privacy policy…); its text is rich text with links. */
  Consent: 'consent',
} as const;
export type FormFieldType = (typeof FormFieldType)[keyof typeof FormFieldType];

export interface FormFieldDefinition {
  readonly type: FormFieldType;
  readonly required?: boolean;
  /** Max characters (text-like fields). Defaults: 200, textarea 5000. */
  readonly max?: number;
  /** Option values of a select (labels are editable texts). */
  readonly options?: readonly string[];
  /** Default label (English); editors can change it per locale. */
  readonly label?: string;
}

export type FormFields = Readonly<Record<string, FormFieldDefinition>>;

/** Seed copy per locale: `{ [fieldKey]: { label, placeholder, help, … }, messages: { … } }`. */
export type FormTextsSeed = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export interface FormInput<Id extends string, F extends FormFields> {
  /** Stable DB key, kebab-case. Never rename after launch. */
  readonly id: Id;
  /** Admin label, e.g. "Contact form". */
  readonly label: string;
  readonly fields: F;
  /** Registered page shown after a successful submission; inline success message otherwise. */
  readonly successRedirectPageId?: string;
  readonly seed?: Partial<Record<ProjectLocale, FormTextsSeed>>;
}

export interface FormDefinition<
  Id extends string = string,
  F extends FormFields = FormFields,
> extends FormInput<Id, F> {
  /** Editable copy as a document schema (one section per field + `messages`). */
  readonly texts: ContentSchema;
}

export type AnyForm = FormDefinition<string, FormFields>;

/** Section of the form-wide messages in the texts schema. */
export const MESSAGES_SECTION = 'messages';
export const DEFAULT_TEXT_MAX = 200;
export const DEFAULT_TEXTAREA_MAX = 5000;
const TEXT_LIKE: ReadonlySet<FormFieldType> = new Set([
  FormFieldType.Text,
  FormFieldType.Email,
  FormFieldType.Tel,
  FormFieldType.Textarea,
]);

export function isTextLike(type: FormFieldType): boolean {
  return TEXT_LIKE.has(type);
}

/** Text key of a select option's label (`project-x` → `option_project_x`). */
export function optionTextKey(value: string): string {
  return `option_${value.replace(/[^a-zA-Z0-9]+/g, '_')}`;
}

/** Storage key of a form's texts in the page tables. */
export function formKey(id: string): string {
  return `form:${id}`;
}

function fieldSection(key: string, field: FormFieldDefinition): SectionDefinition {
  const label = field.label ?? humanizeKey(key);
  const fields: Record<string, AnyField> = {};
  if (field.type === FormFieldType.Consent) {
    fields.label = f.richText({ label: 'Consent text', required: true, max: 500 });
  } else {
    fields.label = f.text({ label: 'Label', required: true, max: 120, default: label });
  }
  if (isTextLike(field.type)) fields.placeholder = f.text({ label: 'Placeholder', max: 120 });
  fields.help = f.text({ label: 'Help text', max: 200 });
  for (const option of field.options ?? []) {
    fields[optionTextKey(option)] = f.text({
      label: `Option “${option}”`,
      required: true,
      max: 120,
      default: humanizeKey(option),
    });
  }
  return { id: key, label, fields };
}

const MESSAGES: SectionDefinition = {
  id: MESSAGES_SECTION,
  label: 'Button and messages',
  fields: {
    submit: f.text({ label: 'Submit button', required: true, max: 40, default: 'Send' }),
    successTitle: f.text({ label: 'Success title', max: 80, default: 'Thank you!' }),
    successMessage: f.textarea({
      label: 'Success message',
      max: 300,
      default: 'We received your message and will reply soon.',
    }),
    confirm: f.text({
      label: 'Confirmation (browsers without JavaScript)',
      help: 'Shown when a visitor without JavaScript must press the button once more.',
      max: 200,
      default: 'Please press the button to send your message.',
    }),
  },
};

export function defineForm<const Id extends string, const F extends FormFields>(
  input: FormInput<Id, F>,
): FormDefinition<Id, F> {
  for (const [key, field] of Object.entries(input.fields)) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) || key === MESSAGES_SECTION) {
      throw new Error(
        `Form "${input.id}": field key "${key}" must be camelCase and not "messages".`,
      );
    }
    if (field.type === FormFieldType.Select && !field.options?.length) {
      throw new Error(`Form "${input.id}": select "${key}" needs options.`);
    }
    if (field.options?.some((option) => !/^[a-z0-9][a-z0-9-]*$/.test(option))) {
      throw new Error(`Form "${input.id}": options of "${key}" must be kebab-case values.`);
    }
  }
  const sections = [
    ...Object.entries(input.fields).map(([key, field]) => fieldSection(key, field)),
    MESSAGES,
  ];
  return { ...input, texts: { sections, ...(input.seed ? { seed: input.seed } : {}) } };
}
