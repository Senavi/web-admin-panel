import { pageSeoSchema, type PageSeo } from '@/core/seo/page-seo';

import type { ContentDocument } from './document';
import { pageContentSchema } from './validation';
import type { ContentRecord } from './values';

export interface ValidatedDocumentInput {
  readonly content: ContentRecord;
  readonly seo: PageSeo;
}

/**
 * Validates editor content + SEO for a document (SEO is ignored for documents
 * without it). Field errors are keyed `content.<section>.<field>` / `seo.<field>`.
 */
export function validateDocumentInput(
  document: Pick<ContentDocument, 'schema' | 'hasSeo'>,
  content: unknown,
  seo: unknown,
): { data: ValidatedDocumentInput } | { fieldErrors: Record<string, string[]> } {
  const contentResult = pageContentSchema(document.schema).safeParse(content);
  const seoResult = pageSeoSchema.safeParse(document.hasSeo ? seo : {});
  if (contentResult.success && seoResult.success) {
    return { data: { content: contentResult.data as ContentRecord, seo: seoResult.data } };
  }
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of contentResult.error?.issues ?? [])
    (fieldErrors[`content.${issue.path.join('.')}`] ??= []).push(issue.message);
  for (const issue of seoResult.error?.issues ?? [])
    (fieldErrors[`seo.${issue.path.join('.')}`] ??= []).push(issue.message);
  return { fieldErrors };
}
