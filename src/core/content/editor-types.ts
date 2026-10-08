import type { SectionDefinition } from './define';
import type { ContentRecord } from './values';
import type { PageSeo } from '@/core/seo/page-seo';

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

export interface EditorPage {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly sections: readonly SectionDefinition[];
  readonly seoDefaults: { readonly title: string; readonly description: string };
}

export interface EditorData {
  readonly page: EditorPage;
  readonly locale: string;
  readonly defaultLocale: string;
  readonly content: ContentRecord;
  /** `section.field` paths not saved for this locale yet (shown with the fallback value). */
  readonly inherited: readonly string[];
  readonly seo: PageSeo;
  readonly versions: EditorVersions;
  readonly media: Readonly<Record<string, MediaPreview>>;
  readonly publicUrl: string;
}

export type LocaleStatus = 'complete' | 'incomplete' | 'missing';

export interface RevisionSummary {
  readonly id: string;
  readonly createdAt: string;
  readonly authorName: string | null;
}
