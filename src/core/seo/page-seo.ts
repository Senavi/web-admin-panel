import { z } from 'zod';

/** Per-page, per-locale SEO overrides (`page_seo`). Empty values fall back to schema/site defaults. */
export const SEO_LIMITS = {
  title: 70,
  description: 160,
  hardTitle: 120,
  hardDescription: 320,
} as const;

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (value) => value === '' || /^https?:\/\//i.test(value),
    'Use a full URL starting with https://',
  );

export const pageSeoSchema = z.object({
  title: z.string().trim().max(SEO_LIMITS.hardTitle).default(''),
  description: z.string().trim().max(SEO_LIMITS.hardDescription).default(''),
  ogTitle: z.string().trim().max(SEO_LIMITS.hardTitle).default(''),
  ogDescription: z.string().trim().max(SEO_LIMITS.hardDescription).default(''),
  ogImageId: z.uuid().nullable().default(null),
  canonical: optionalUrl.default(''),
  noindex: z.boolean().default(false),
});

export type PageSeo = z.output<typeof pageSeoSchema>;

export function parsePageSeo(raw: unknown): PageSeo {
  const result = pageSeoSchema.safeParse(raw ?? {});
  return result.success ? result.data : pageSeoSchema.parse({});
}
