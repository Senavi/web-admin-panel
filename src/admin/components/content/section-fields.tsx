'use client';

import { useEffect } from 'react';
import { useFormState, useWatch } from 'react-hook-form';

import {
  AccordionSection,
  AccordionToolbar,
  useAccordionState,
} from '@/admin/components/layout/accordion';
import { FieldGroup } from '@/admin/ui/field';
import type { SectionDefinition } from '@/core/content/define';
import { type AnyField, FieldKind, fieldLabel } from '@/core/content/fields';
import { richTextToPlainText, type RichTextDoc } from '@/core/content/rich-text';

import { FieldControl } from './fields/field-control';

const SUMMARY_MAX = 80;

/** Short text for a closed section: its first two non-empty values ("Title · 4 items"). */
function summarize(fields: Readonly<Record<string, AnyField>>, values: unknown): string {
  const record = (typeof values === 'object' && values !== null ? values : {}) as Record<
    string,
    unknown
  >;
  const parts: string[] = [];
  for (const [key, field] of Object.entries(fields)) {
    const value = record[key];
    let text = '';
    if (field.kind === FieldKind.List && Array.isArray(value)) {
      text = value.length > 0 ? `${value.length} ${value.length === 1 ? 'item' : 'items'}` : '';
    } else if (field.kind === FieldKind.RichText && value && typeof value === 'object') {
      text = richTextToPlainText(value as RichTextDoc);
    } else if (field.kind === FieldKind.Link && value && typeof value === 'object') {
      text = String((value as { label?: unknown }).label ?? '');
    } else if (typeof value === 'string' && field.kind !== FieldKind.Color) {
      text = value;
    }
    if (text.trim()) parts.push(text.trim());
    if (parts.length === 2) break;
  }
  const summary = parts.join(' · ');
  return summary.length > SUMMARY_MAX ? `${summary.slice(0, SUMMARY_MAX - 1)}…` : summary;
}

function SectionSummary({ section }: { section: SectionDefinition }) {
  const values: unknown = useWatch({ name: `content.${section.id}` });
  return <>{summarize(section.fields, values)}</>;
}

/**
 * The generated fields of a document, one collapsible card per section (first
 * open). Sections with validation errors open when the form is submitted.
 */
export function SectionFields({ sections }: { sections: readonly SectionDefinition[] }) {
  const state = useAccordionState(sections.map((section) => section.id));
  const { errors, submitCount } = useFormState({ name: 'content' });
  const contentErrors = (errors.content ?? {}) as Record<string, unknown>;
  const invalidIds = sections
    .filter((section) => contentErrors[section.id] !== undefined)
    .map((section) => section.id);
  const invalidKey = invalidIds.join(',');

  useEffect(() => {
    if (submitCount > 0 && invalidKey) state.openSections(invalidKey.split(','));
    // Only when a save attempt reports (new) errors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitCount, invalidKey]);

  return (
    <div className="flex flex-col gap-4">
      {sections.length > 1 ? (
        <AccordionToolbar
          state={state}
          label={`${sections.length} ${sections.length === 1 ? 'section' : 'sections'}`}
        />
      ) : null}
      {sections.map((section) => (
        <AccordionSection
          key={section.id}
          title={section.label}
          description={section.description}
          summary={<SectionSummary section={section} />}
          open={state.isOpen(section.id)}
          onOpenChange={(open) => state.setOpen(section.id, open)}
          invalid={invalidIds.includes(section.id)}
        >
          <FieldGroup>
            {Object.entries(section.fields).map(([key, field]) => (
              <FieldControl
                key={key}
                name={`content.${section.id}.${key}`}
                field={field}
                label={fieldLabel(key, field)}
                contentPath={`${section.id}.${key}`}
              />
            ))}
          </FieldGroup>
        </AccordionSection>
      ))}
    </div>
  );
}
