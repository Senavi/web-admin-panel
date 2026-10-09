import type { PageSeo } from '@/core/seo/page-seo';

import type { SectionDefinition } from './define';
import type { DocumentTarget } from './document-target';
import type { ContentRecord } from './values';

/** Serializable data the admin editor needs (sent from server to client components). */

export interface MediaPreview {
  readonly id: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

export interface EditorVersions {
  /** 0 when the row doesn't exist yet. */
  readonly shared: number;
  readonly localized: number;
  readonly seo: number;
}

export interface EditorDocument {
  readonly target: DocumentTarget;
  readonly label: string;
  /** Public path in the default locale; null for documents without a page (globals, forms). */
  readonly path: string | null;
  readonly sections: readonly SectionDefinition[];
  readonly hasSeo: boolean;
  readonly seoDefaults: { readonly title: string; readonly description: string };
}

export interface EditorData {
  readonly document: EditorDocument;
  readonly locale: string;
  readonly defaultLocale: string;
  readonly content: ContentRecord;
  /** `section.field` paths not saved for this locale yet (shown with the fallback value). */
  readonly inherited: readonly string[];
  readonly seo: PageSeo;
  readonly versions: EditorVersions;
  readonly media: Readonly<Record<string, MediaPreview>>;
  /** Public URL of this locale; null when the document has no page of its own. */
  readonly publicUrl: string | null;
}

export type LocaleStatus = 'complete' | 'incomplete' | 'missing';

export interface RevisionSummary {
  readonly id: string;
  readonly createdAt: string;
  readonly authorName: string | null;
}
