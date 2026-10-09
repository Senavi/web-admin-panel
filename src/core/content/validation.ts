import { z } from 'zod';

import type { ContentSchema } from './define';
import { type AnyField, FieldKind, type ListItemFields, type ScalarField } from './fields';
import { richTextDocSchema, richTextToPlainText } from './rich-text';

/**
 * Zod validators derived from field descriptors. The same schemas validate the
 * admin form (client) and the save action (server).
 */

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SAFE_LINK = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;
const REQUIRED = 'This field is required.';

function textSchema(options: { required: boolean; min?: number; max?: number }) {
  let schema = z.string().trim();
  if (options.max !== undefined)
    schema = schema.max(options.max, `Use at most ${options.max} characters.`);
  if (options.required) schema = schema.min(Math.max(1, options.min ?? 1), REQUIRED);
  else if (options.min !== undefined) {
    const min = options.min;
    return schema.refine(
      (value) => value === '' || value.length >= min,
      `Use at least ${min} characters.`,
    );
  }
  return schema;
}

export function fieldSchema(field: AnyField): z.ZodType {
  switch (field.kind) {
    case FieldKind.Text:
      return textSchema(field);
    case FieldKind.Textarea:
      return textSchema(field);
    case FieldKind.RichText:
      return richTextDocSchema.superRefine((doc, ctx) => {
        const length = richTextToPlainText(doc).length;
        if (field.required && length === 0) ctx.addIssue({ code: 'custom', message: REQUIRED });
        if (field.max !== undefined && length > field.max) {
          ctx.addIssue({ code: 'custom', message: `Use at most ${field.max} characters.` });
        }
      });
    case FieldKind.Image:
      return z
        .object({
          mediaId: z.uuid().nullable(),
          alt: z.string().trim().max(250, 'Use at most 250 characters.'),
        })
        .superRefine((value, ctx) => {
          if (field.required && !value.mediaId)
            ctx.addIssue({ code: 'custom', message: 'Choose an image.', path: ['mediaId'] });
          if (value.mediaId && !value.alt) {
            ctx.addIssue({
              code: 'custom',
              message: 'Describe the image for screen readers.',
              path: ['alt'],
            });
          }
        });
    case FieldKind.Link:
      return z
        .object({
          label: z.string().trim().max(80),
          href: z
            .string()
            .trim()
            .max(2000)
            .refine(
              (value) => value === '' || SAFE_LINK.test(value),
              'Use an http(s) URL, a path like /about, mailto: or tel:.',
            ),
          external: z.boolean(),
        })
        .superRefine((value, ctx) => {
          if (field.required && !value.href)
            ctx.addIssue({ code: 'custom', message: REQUIRED, path: ['href'] });
          if (value.href && !value.label)
            ctx.addIssue({ code: 'custom', message: 'Add a label for the link.', path: ['label'] });
        });
    case FieldKind.Boolean:
      return z.boolean();
    case FieldKind.Number: {
      let schema = z.number({ error: 'Enter a number.' });
      if (field.integer) schema = schema.int('Enter a whole number.');
      if (field.min !== undefined) schema = schema.min(field.min);
      if (field.max !== undefined) schema = schema.max(field.max);
      return schema;
    }
    case FieldKind.Select:
      return z.enum(field.options.map((option) => option.value) as [string, ...string[]]);
    case FieldKind.Color:
      return z.string().regex(HEX_COLOR, 'Use a hex color like #1d4ed8.');
    case FieldKind.List: {
      let schema = z.array(listItemSchema(field.of));
      if (field.min !== undefined)
        schema = schema.min(field.min, `Add at least ${field.min} item(s).`);
      if (field.max !== undefined)
        schema = schema.max(field.max, `Use at most ${field.max} items.`);
      return schema;
    }
  }
}

function listItemSchema(of: ListItemFields) {
  const shape: Record<string, z.ZodType> = { _key: z.string().min(1).max(64) };
  for (const [key, field] of Object.entries(of))
    shape[key] = fieldSchema(field satisfies ScalarField);
  return z.object(shape);
}

/** Validator for a full page's content in one locale (shared + localized values merged). */
export function pageContentSchema(page: Pick<ContentSchema, 'sections'>) {
  const sections: Record<string, z.ZodType> = {};
  for (const section of page.sections) {
    const shape: Record<string, z.ZodType> = {};
    for (const [key, field] of Object.entries(section.fields)) shape[key] = fieldSchema(field);
    sections[section.id] = z.object(shape);
  }
  return z.object(sections);
}

/** Returns the stored value if it is still valid for the field, otherwise undefined (→ fallback). */
export function parseStoredValue(field: AnyField, raw: unknown): unknown {
  if (raw === undefined) return undefined;
  const result = fieldSchema(relaxed(field)).safeParse(raw);
  return result.success ? result.data : undefined;
}

/**
 * Stored data is validated structurally only: "required" and list minimums are
 * save-time rules, so older or partially translated content is still readable.
 */
function relaxed(field: AnyField): AnyField {
  if (field.kind !== FieldKind.List) return { ...field, required: false };
  const of: Record<string, ScalarField> = {};
  for (const [key, item] of Object.entries(field.of)) of[key] = { ...item, required: false };
  return { ...field, required: false, min: undefined, of };
}
