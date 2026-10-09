import type { RichTextDoc } from '@/core/content/rich-text';

import type { FormFieldDefinition } from './define';

/**
 * Everything a site form component needs for one locale (serializable, so a
 * server component can pass it to the project's client form). Built by
 * `getSiteFormConfig()`.
 */
export interface SiteFormField {
  readonly name: string;
  readonly definition: FormFieldDefinition;
  readonly label: string;
  readonly placeholder: string;
  readonly help: string;
  /** Select options with their localized labels. */
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  /** Consent fields: the agreement text (rich text with links). */
  readonly consentText: RichTextDoc | null;
}

export interface SiteFormConfig {
  readonly formId: string;
  readonly locale: string;
  readonly fields: readonly SiteFormField[];
  readonly submitLabel: string;
  readonly successTitle: string;
  readonly successMessage: string;
  /** Confirm step for browsers without JavaScript. */
  readonly confirmMessage: string;
}
