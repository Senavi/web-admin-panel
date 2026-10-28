'use client';

import { Loader2Icon, RotateCcwIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { SimpleSelect } from '@/admin/components/forms/simple-select';
import { Alert, AlertDescription } from '@/admin/ui/alert';
import { Button } from '@/admin/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/admin/ui/dialog';
import { ActionErrorCode } from '@/core/actions/result';
import {
  type CodeDefaultsPreview,
  previewCodeDefaultsAction,
  resetToCodeDefaultsAction,
} from '@/core/content/actions';
import type { EditorData, EditorVersions } from '@/core/content/editor-types';
import type { ContentRecord } from '@/core/content/values';

/** Scope value for "every section of this page" (section ids are kebab-case, never empty). */
const ALL_SECTIONS = '';

export interface CodeDefaultsResult {
  readonly content: ContentRecord;
  readonly versions: EditorVersions;
  /** Set when a shared section was reset (`versions` are its versions). */
  readonly sharedId: string | null;
}

/**
 * "Reset to code defaults" for the current language: choose all sections or
 * one, see which fields will change, confirm. Saved as a normal revision, so it
 * can be undone from the history.
 */
export function CodeDefaultsDialog({
  open,
  onOpenChange,
  data,
  versions,
  sharedVersions,
  dirty,
  localeLabel,
  onReset,
  onConflict,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: EditorData;
  versions: EditorVersions;
  sharedVersions: Readonly<Record<string, EditorVersions>>;
  dirty: boolean;
  localeLabel: string;
  onReset: (result: CodeDefaultsResult) => void;
  onConflict: (message: string) => void;
}) {
  const [scope, setScope] = useState(ALL_SECTIONS);
  // Keyed by scope: a result for another scope means the new one is still loading.
  const [loaded, setLoaded] = useState<{
    scope: string;
    preview: CodeDefaultsPreview | null;
    error: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const sharedIds = new Set(data.shared.map((shared) => shared.id));

  useEffect(() => {
    if (!open) return;
    let current = true;
    void previewCodeDefaultsAction({
      target: data.document.target,
      locale: data.locale,
      sectionId: scope || undefined,
    }).then((result) => {
      if (!current) return;
      setLoaded(
        result.ok
          ? { scope, preview: result.data, error: null }
          : { scope, preview: null, error: result.error },
      );
    });
    return () => {
      current = false;
    };
  }, [open, scope, data.document.target, data.locale]);

  /** Closing forgets the comparison (the content may change before the next open). */
  const setOpen = (next: boolean) => {
    if (!next) setLoaded(null);
    onOpenChange(next);
  };

  const reset = async () => {
    setBusy(true);
    const result = await resetToCodeDefaultsAction({
      target: data.document.target,
      locale: data.locale,
      sectionId: scope || undefined,
      versions: sharedIds.has(scope) ? (sharedVersions[scope] ?? versions) : versions,
    });
    setBusy(false);
    if (!result.ok) {
      if (result.code === ActionErrorCode.Conflict) {
        setOpen(false);
        onConflict(result.error);
      } else toast.error(result.error);
      return;
    }
    onReset(result.data);
    setOpen(false);
    toast.success(result.message ?? 'Reset to the code defaults.');
  };

  const current = open && loaded?.scope === scope ? loaded : null;
  const preview = current?.preview ?? null;
  const error = current?.error ?? null;
  const changes = preview?.changes ?? [];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reset to code defaults</DialogTitle>
          <DialogDescription>
            Puts back the texts and images the site’s code ships with, in {localeLabel}. Other
            languages don’t change. You can undo it from the history.
          </DialogDescription>
        </DialogHeader>

        <SimpleSelect
          value={scope}
          onChange={setScope}
          ariaLabel="What to reset"
          options={[
            { value: ALL_SECTIONS, label: 'All sections' },
            ...data.document.sections.map((section) => ({
              value: section.id,
              label: sharedIds.has(section.id) ? `${section.label} (shared)` : section.label,
            })),
          ]}
        />

        {dirty ? (
          <Alert>
            <AlertDescription>Your unsaved changes in this language will be lost.</AlertDescription>
          </Alert>
        ) : null}
        {preview?.shared ? (
          <Alert>
            <AlertDescription>
              “{preview.shared.label}” is a shared section: the reset changes it on all{' '}
              {preview.shared.pages} pages that use it.
            </AlertDescription>
          </Alert>
        ) : null}
        {scope === ALL_SECTIONS && sharedIds.size > 0 ? (
          <p className="text-sm text-muted-foreground">
            Shared sections are not included: choose one above to reset it.
          </p>
        ) : null}

        <div aria-live="polite" className="min-h-16">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !current ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> Comparing with the code…
            </p>
          ) : changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing to reset: this is already the same as the code.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                {changes.length === 1
                  ? '1 field will change:'
                  : `${changes.length} fields will change:`}
              </p>
              <ul
                aria-label="Fields that will change"
                className="max-h-56 list-disc overflow-y-auto pl-5 text-sm"
              >
                {changes.map((change) => (
                  <li key={`${change.section}/${change.field}`}>
                    {change.section}: {change.field}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy || changes.length === 0}
            onClick={() => void reset()}
          >
            {busy ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
