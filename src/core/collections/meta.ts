import { z } from 'zod';

import { CollectionItemStatus } from '@/core/content/collection';
import { SLUG_MAX, SLUG_PATTERN } from '@/core/content/slug';

/**
 * Item settings edited next to the content (client + server validation):
 * slug, status and publish date, plus the row version for conflict detection.
 */
export const itemMetaSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Enter a URL slug.')
    .max(SLUG_MAX, `Use at most ${SLUG_MAX} characters.`)
    .regex(SLUG_PATTERN, 'Use lowercase letters, digits and dashes (e.g. my-first-post).'),
  status: z.enum([CollectionItemStatus.Draft, CollectionItemStatus.Published]),
  /** `YYYY-MM-DD`, empty = set on publish. */
  publishedAt: z.union([z.literal(''), z.iso.date('Use a valid date.')]),
  version: z.number().int().min(1),
});
export type ItemMeta = z.infer<typeof itemMetaSchema>;

/** Date part (`YYYY-MM-DD`, UTC) of a timestamp for the date input. */
export function toDateInput(value: Date | string | null): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}
