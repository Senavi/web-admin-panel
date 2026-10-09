import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { CacheTag } from '@/core/cache/tags';
import { humanizeKey } from '@/core/content/fields';
import type { RichTextDoc } from '@/core/content/rich-text';
import { contentRegistry } from '@/core/content/project-registry';
import { loadDocumentContent } from '@/core/content/loader';

import type { SiteFormConfig } from './config';
import { FormFieldType, formKey, MESSAGES_SECTION, optionTextKey } from './define';

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Form definition + its edited texts for a locale (fallback chain as pages),
 * cached and tagged `form:{id}`. Pass the result to a client form using
 * `useSiteForm`.
 */
export async function getSiteFormConfig(formId: string, locale: string): Promise<SiteFormConfig> {
  'use cache';
  cacheLife('max');
  cacheTag(CacheTag.form(formId), CacheTag.Settings);
  const form = contentRegistry.formById(formId);
  if (!form) throw new Error(`Unknown form "${formId}".`);
  const texts = await loadDocumentContent(form.texts, formKey(form.id), locale);
  const messages = texts[MESSAGES_SECTION] ?? {};
  return {
    formId: form.id,
    locale,
    fields: Object.entries(form.fields).map(([name, definition]) => {
      const copy = texts[name] ?? {};
      return {
        name,
        definition,
        // Consent copy is rich text (consentText); its label names it in error summaries.
        label:
          definition.type === FormFieldType.Consent
            ? (definition.label ?? humanizeKey(name))
            : text(copy.label),
        placeholder: text(copy.placeholder),
        help: text(copy.help),
        options: (definition.options ?? []).map((value) => ({
          value,
          label: text(copy[optionTextKey(value)]) || value,
        })),
        consentText: definition.type === FormFieldType.Consent ? (copy.label as RichTextDoc) : null,
      };
    }),
    submitLabel: text(messages.submit),
    successTitle: text(messages.successTitle),
    successMessage: text(messages.successMessage),
    confirmMessage: text(messages.confirm),
  };
}
