import type { ReactNode } from 'react';

/**
 * The project's part of `/storybook`: `src/site/storybook.tsx` exports
 * `storybookSections` (buttons, form fields, icons, any other primitive or
 * pattern). Core renders the token sections itself (colors, fonts, text styles,
 * spacing, radii, shadows).
 */
export interface StorybookSection {
  /** Anchor and nav id, kebab-case. */
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly render: () => ReactNode;
}

/** Path of the project slot, checked by `content:check`. */
export const STORYBOOK_SLOT_FILE = 'src/site/storybook.tsx';
/** The export `content:check` looks for in the slot. */
export const STORYBOOK_SLOT_EXPORT = 'storybookSections';
/** Public path of the page (not localized, not in the sitemap). */
export const STORYBOOK_PATH = '/storybook';

/**
 * Problems with the project slot file (`content:check`): it must exist, export
 * `storybookSections` and fill the sections every project needs. `source` is the
 * file's text, or null when it doesn't exist.
 */
export function checkStorybookSlot(source: string | null): string[] {
  if (source === null) {
    return [`${STORYBOOK_SLOT_FILE} is missing (the /storybook slot; see docs/CUSTOMIZING.md).`];
  }
  const problems: string[] = [];
  if (!new RegExp(`export\\s+const\\s+${STORYBOOK_SLOT_EXPORT}\\b`).test(source)) {
    problems.push(`${STORYBOOK_SLOT_FILE} must export \`${STORYBOOK_SLOT_EXPORT}\`.`);
  }
  for (const id of REQUIRED_STORYBOOK_SECTIONS) {
    if (!new RegExp(`id:\\s*['"]${id}['"]`).test(source)) {
      problems.push(`${STORYBOOK_SLOT_FILE} has no "${id}" section.`);
    }
  }
  return problems;
}

/** Sections every project fills (the demo fills them completely). */
export const REQUIRED_STORYBOOK_SECTIONS = ['buttons', 'form-fields', 'icons'] as const;
