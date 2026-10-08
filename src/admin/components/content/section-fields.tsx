'use client';

import { ChevronDownIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/admin/ui/collapsible';
import { FieldGroup } from '@/admin/ui/field';
import type { SectionDefinition } from '@/core/content/define';
import { fieldLabel } from '@/core/content/fields';

import { FieldControl } from './fields/field-control';

/** One collapsible card per section with its generated fields. */
export function SectionFields({ sections }: { sections: readonly SectionDefinition[] }) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <Collapsible key={section.id} defaultOpen render={<Card />}>
          <CardHeader>
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-start [&[data-panel-open]>svg]:rotate-180">
              <span className="flex flex-col gap-1">
                <CardTitle>
                  <h2>{section.label}</h2>
                </CardTitle>
                {section.description ? (
                  <CardDescription>{section.description}</CardDescription>
                ) : null}
              </span>
              <ChevronDownIcon aria-hidden className="size-4 shrink-0 transition-transform" />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
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
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
