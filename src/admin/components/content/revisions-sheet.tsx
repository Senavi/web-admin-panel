'use client';

import { HistoryIcon, Loader2Icon, RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { formatDateTime } from '@/admin/lib/format';
import { Button } from '@/admin/ui/button';
import { ScrollArea } from '@/admin/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/admin/ui/sheet';
import {
  getRevisionAction,
  listRevisionsAction,
  restoreRevisionAction,
  type RevisionPreview,
} from '@/core/content/actions';
import type { EditorData, EditorVersions, RevisionSummary } from '@/core/content/editor-types';

import { EditorProvider } from './editor-context';
import { SectionFields } from './section-fields';

/** Revision history: list, read-only preview, restore. */
export function RevisionsSheet({
  data,
  versions,
  dirty,
  onRestored,
}: {
  data: EditorData;
  versions: EditorVersions;
  dirty: boolean;
  onRestored: (values: RevisionPreview, versions: EditorVersions) => void;
}) {
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [selected, setSelected] = useState<{ id: string; preview: RevisionPreview } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setRevisions(null);
    setSelected(null);
    const result = await listRevisionsAction({ pageId: data.page.id, locale: data.locale });
    if (result.ok) setRevisions(result.data);
    else toast.error(result.error);
  };

  const preview = async (id: string) => {
    setBusy(true);
    const result = await getRevisionAction({ revisionId: id });
    setBusy(false);
    if (result.ok) setSelected({ id, preview: result.data });
    else toast.error(result.error);
  };

  const restore = async () => {
    if (!selected) return;
    if (dirty && !window.confirm('Restoring replaces your unsaved changes. Continue?')) return;
    setBusy(true);
    const result = await restoreRevisionAction({ revisionId: selected.id, versions });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? 'Revision restored.');
    onRestored(selected.preview, result.data.versions);
    setOpen(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <SheetTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <HistoryIcon />
        History
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Revision history</SheetTitle>
          <SheetDescription>
            The last 20 saved versions of this page in this language. Restoring creates a new
            version.
          </SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 gap-4 px-4 pb-4 md:grid-cols-[14rem_1fr]">
          <ScrollArea className="max-h-[70vh] rounded-md border">
            {revisions === null ? (
              <p className="text-sm p-3 text-muted-foreground">Loading…</p>
            ) : revisions.length === 0 ? (
              <p className="text-sm p-3 text-muted-foreground">No saved versions yet.</p>
            ) : (
              <ul className="divide-y" aria-label="Revisions">
                {revisions.map((revision, index) => (
                  <li key={revision.id}>
                    <button
                      type="button"
                      onClick={() => void preview(revision.id)}
                      aria-current={selected?.id === revision.id ? 'true' : undefined}
                      className="text-sm hover:bg-muted aria-[current=true]:bg-muted flex w-full flex-col items-start gap-0.5 p-3 text-start"
                    >
                      <span className="font-medium">{formatDateTime(revision.createdAt)}</span>
                      <span className="text-xs text-muted-foreground">
                        {revision.authorName ?? 'Unknown'}
                        {index === 0 ? ' · current' : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
          <div className="flex min-h-0 flex-col gap-3">
            {busy && !selected ? <Loader2Icon className="animate-spin" /> : null}
            {selected ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">Read-only preview</p>
                  <Button type="button" size="sm" onClick={() => void restore()} disabled={busy}>
                    {busy ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
                    Restore this version
                  </Button>
                </div>
                <ScrollArea className="max-h-[65vh]">
                  <RevisionPreviewForm data={data} preview={selected.preview} />
                </ScrollArea>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a version to preview it.</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RevisionPreviewForm({ data, preview }: { data: EditorData; preview: RevisionPreview }) {
  const form = useForm({ values: { content: preview.content, seo: preview.seo } });
  return (
    <EditorProvider
      locale={data.locale}
      defaultLocale={data.defaultLocale}
      inherited={[]}
      initialMedia={{ ...data.media, ...preview.media }}
      readOnly
    >
      <FormProvider {...form}>
        <fieldset disabled className="min-w-0">
          <SectionFields sections={data.page.sections} />
        </fieldset>
      </FormProvider>
    </EditorProvider>
  );
}
