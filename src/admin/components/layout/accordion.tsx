'use client';

import { ChevronDownIcon } from 'lucide-react';
import { type ReactNode, useCallback, useState } from 'react';

import { cn } from '@/admin/lib/utils';
import { Button } from '@/admin/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/admin/ui/collapsible';

/**
 * The admin's one accordion rule: in a list of sections only the first starts
 * open; a standalone collapsible starts closed. Closed headers show a short
 * summary of their content; lists offer "Expand all / Collapse all"; a section
 * with a validation error opens when the form is saved (`openSections`).
 */

export interface AccordionState {
  isOpen(id: string): boolean;
  setOpen(id: string, open: boolean): void;
  /** Opens the given sections (e.g. the ones with validation errors). */
  openSections(ids: Iterable<string>): void;
  expandAll(): void;
  collapseAll(): void;
}

export function useAccordionState(
  ids: readonly string[],
  initiallyOpen: readonly string[] = ids.slice(0, 1),
): AccordionState {
  const [open, setOpenIds] = useState<ReadonlySet<string>>(() => new Set(initiallyOpen));
  const setOpen = useCallback((id: string, next: boolean) => {
    setOpenIds((current) => {
      const copy = new Set(current);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }, []);
  return {
    isOpen: (id) => open.has(id),
    setOpen,
    openSections: (more) => setOpenIds((current) => new Set([...current, ...more])),
    expandAll: () => setOpenIds(new Set(ids)),
    collapseAll: () => setOpenIds(new Set()),
  };
}

export function AccordionToolbar({ state, label }: { state: AccordionState; label?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : <span />}
      <div className="flex gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={state.expandAll}>
          Expand all
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={state.collapseAll}>
          Collapse all
        </Button>
      </div>
    </div>
  );
}

export function AccordionSection({
  id,
  title,
  description,
  summary,
  open,
  onOpenChange,
  invalid = false,
  children,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  /** Shown under the title while the section is closed. */
  summary?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Marks the header when the section contains a validation error. */
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      render={<Card id={id} className="scroll-mt-20" />}
      data-invalid={invalid || undefined}
    >
      <CardHeader>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-start [&[data-panel-open]>svg]:rotate-180">
          <span className="flex min-w-0 flex-col gap-1">
            <CardTitle>
              <h2 className={cn(invalid && 'text-destructive')}>{title}</h2>
            </CardTitle>
            {open && description ? <CardDescription>{description}</CardDescription> : null}
            {!open && summary ? (
              <CardDescription className="truncate">{summary}</CardDescription>
            ) : null}
          </span>
          <ChevronDownIcon aria-hidden className="size-4 shrink-0 transition-transform" />
        </CollapsibleTrigger>
      </CardHeader>
      <CollapsibleContent>
        <CardContent>{children}</CardContent>
      </CollapsibleContent>
    </Collapsible>
  );
}

export interface SectionListItem {
  readonly id: string;
  readonly title: string;
  readonly description?: ReactNode;
  readonly summary?: ReactNode;
  readonly content: ReactNode;
}

/** A list of sections: first open (or `openId`), Expand all / Collapse all. */
export function SectionList({
  sections,
  openId,
}: {
  sections: readonly SectionListItem[];
  /** Section to open instead of the first (e.g. the one a redirect points to). */
  openId?: string;
}) {
  const ids = sections.map((section) => section.id);
  const state = useAccordionState(ids, openId ? [openId] : ids.slice(0, 1));
  return (
    <div className="flex flex-col gap-4">
      {sections.length > 1 ? <AccordionToolbar state={state} /> : null}
      {sections.map((section) => (
        <AccordionSection
          key={section.id}
          id={section.id}
          title={section.title}
          description={section.description}
          summary={section.summary}
          open={state.isOpen(section.id)}
          onOpenChange={(open) => state.setOpen(section.id, open)}
        >
          {section.content}
        </AccordionSection>
      ))}
    </div>
  );
}

/** A standalone collapsible section: starts closed. */
export function CollapsibleSection({
  id,
  title,
  summary,
  children,
}: {
  id?: string;
  title: string;
  summary?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AccordionSection id={id} title={title} summary={summary} open={open} onOpenChange={setOpen}>
      {children}
    </AccordionSection>
  );
}
