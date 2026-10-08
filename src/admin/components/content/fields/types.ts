import type { AnyField } from '@/core/content/fields';

/** Props every generated field control receives. */
export interface FieldControlProps<F extends AnyField = AnyField> {
  /** react-hook-form path, e.g. `content.hero.title` or `content.features.items.2.title`. */
  readonly name: string;
  readonly field: F;
  readonly label: string;
  /** `section.field` for top-level fields (inherited indicator); absent inside lists. */
  readonly contentPath?: string;
}

export function controlId(name: string): string {
  return `field-${name.replace(/[^a-zA-Z0-9]+/g, '-')}`;
}
