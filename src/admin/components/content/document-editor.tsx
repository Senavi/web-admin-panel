'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangleIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  Loader2Icon,
  RotateCcwIcon,
  SaveIcon,
  Undo2Icon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { FormProvider, useForm, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { SimpleSelect } from '@/admin/components/forms/simple-select';
import { useHydrated } from '@/admin/hooks/use-hydrated';
import { confirmLeave, useUnsavedGuard } from '@/admin/hooks/use-unsaved-guard';
import { Alert, AlertDescription, AlertTitle } from '@/admin/ui/alert';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/admin/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/admin/ui/tabs';
import { ActionErrorCode, type ActionResult } from '@/core/actions/result';
import { saveDocumentAction, type RevisionPreview } from '@/core/content/actions';
import { DocumentKind } from '@/core/content/document-target';
import type { EditorData, EditorVersions } from '@/core/content/editor-types';
import { pageContentSchema } from '@/core/content/validation';
import { pageSeoSchema } from '@/core/seo/page-seo';

import { CodeDefaultsDialog, type CodeDefaultsResult } from './code-defaults-dialog';
import { EditorProvider } from './editor-context';
import { InterfaceTextsPanel } from './interface-texts-panel';
import { RevisionsSheet } from './revisions-sheet';
import { SectionFields } from './section-fields';
import { SeoPanel } from './seo-panel';

export interface LocaleOption {
  readonly code: string;
  readonly label: string;
  /** Draft language: editable here, hidden on the site. */
  readonly draft?: boolean;
}

const NO_EXTRA = z.object({});

function editorSchema(document: EditorData['document'], extra: z.ZodType) {
  return z.object({ content: pageContentSchema(document), seo: pageSeoSchema, extra });
}
type EditorSchema = ReturnType<typeof editorSchema>;
export type EditorValues = z.input<EditorSchema>;
export type EditorOutput = z.output<EditorSchema>;

/**
 * Saves the editor's values; defaults to `saveDocumentAction`. Returning
 * `extra` replaces the extra values after a save (e.g. a new item version).
 */
export type DocumentSave = (
  values: EditorOutput,
  versions: EditorVersions,
) => Promise<ActionResult<{ versions: EditorVersions; extra?: Record<string, unknown> }>>;

export interface DocumentEditorProps {
  readonly data: EditorData;
  readonly locales: readonly LocaleOption[];
  /** Admin URL of this editor without `locale` (the locale switcher appends it). */
  readonly basePath: string;
  /** Extra form values under `extra.*` (e.g. collection item slug/status) with their validator. */
  readonly extra?: { readonly defaults: Record<string, unknown>; readonly schema: z.ZodType };
  readonly save?: DocumentSave;
  /** Rendered above the tabs, inside the form (can use `useFormContext`). */
  readonly panel?: ReactNode;
  /** Extra header actions (e.g. Publish, Delete). */
  readonly actions?: ReactNode;
  readonly subtitle?: string;
}

/**
 * Generated editor for any document (page, global, form texts, collection
 * item): locale switcher, Content (+ SEO) tabs, unsaved-changes guard, revision
 * history and conflict detection.
 */
export function DocumentEditor({
  data,
  locales,
  basePath,
  extra,
  save: saveValues,
  panel,
  actions,
  subtitle,
}: DocumentEditorProps) {
  const router = useRouter();
  const extraSchema = extra?.schema ?? NO_EXTRA;
  const schema = useMemo(
    () => editorSchema(data.document, extraSchema),
    [data.document, extraSchema],
  );
  const form = useForm<EditorValues, unknown, EditorOutput>({
    defaultValues: { content: data.content, seo: data.seo, extra: extra?.defaults ?? {} },
    resolver: zodResolver(schema),
    mode: 'onBlur',
  });
  const [versions, setVersions] = useState<EditorVersions>(data.versions);
  // Shared sections placed on this page: saved with it when edited here.
  const placedShared = data.document.target.kind === DocumentKind.Page ? data.shared : [];
  const [sharedVersions, setSharedVersions] = useState<Record<string, EditorVersions>>(() =>
    Object.fromEntries(placedShared.map((shared) => [shared.id, shared.versions])),
  );
  const [conflict, setConflict] = useState<string | null>(null);
  const [tab, setTab] = useState<string>('content');
  const [resetOpen, setResetOpen] = useState(false);
  const localeLabel = locales.find((locale) => locale.code === data.locale)?.label ?? data.locale;
  const { isDirty, isSubmitting } = form.formState;
  const hydrated = useHydrated();
  useUnsavedGuard(isDirty);

  const save = form.handleSubmit(
    async (values) => {
      const dirtyContent = (form.formState.dirtyFields.content ?? {}) as Record<string, unknown>;
      const editedShared = placedShared
        .filter((shared) => dirtyContent[shared.id] !== undefined)
        .map((shared) => ({
          id: shared.id,
          versions: sharedVersions[shared.id] ?? shared.versions,
        }));
      const result = saveValues
        ? await saveValues(values, versions)
        : await saveDocumentAction({
            target: data.document.target,
            locale: data.locale,
            content: values.content,
            seo: values.seo,
            versions,
            shared: editedShared,
          });
      if (result.ok) {
        setVersions(result.data.versions);
        if ('sharedVersions' in result.data) {
          const next = result.data.sharedVersions;
          setSharedVersions((current) => ({ ...current, ...next }));
        }
        setConflict(null);
        form.reset({ ...values, extra: 'extra' in result.data ? result.data.extra : values.extra });
        toast.success(result.message ?? 'Saved.');
        router.refresh();
        return;
      }
      if (result.code === ActionErrorCode.Conflict) {
        setConflict(result.error);
        return;
      }
      for (const [path, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(path as FieldPath<EditorValues>, { type: 'server', message: messages[0] });
      }
      if (Object.keys(result.fieldErrors ?? {}).some((path) => path.startsWith('seo.')))
        setTab('seo');
      toast.error(result.error);
    },
    (errors) => {
      if (errors.seo && !errors.content) setTab('seo');
      toast.error('Please fix the highlighted fields.');
    },
  );

  const onRestored = (values: RevisionPreview, next: EditorVersions) => {
    setVersions(next);
    setConflict(null);
    // A page revision holds the page's own sections; shared sections keep their values.
    form.reset({
      ...form.getValues(),
      content: { ...form.getValues().content, ...values.content },
      seo: values.seo,
    });
    router.refresh();
  };

  /** After "Reset to code defaults": the last saved values with the reset sections replaced. */
  const onCodeDefaults = (result: CodeDefaultsResult) => {
    if (result.sharedId) {
      const id = result.sharedId;
      setSharedVersions((current) => ({ ...current, [id]: result.versions }));
    } else setVersions(result.versions);
    setConflict(null);
    const saved = form.formState.defaultValues as EditorValues;
    form.reset({ ...saved, content: { ...saved.content, ...result.content } });
    router.refresh();
  };

  const switchLocale = (code: string) => {
    if (code === data.locale || !confirmLeave(isDirty)) return;
    router.push(`${basePath}${basePath.includes('?') ? '&' : '?'}locale=${code}`);
  };

  return (
    <EditorProvider
      locale={data.locale}
      defaultLocale={data.defaultLocale}
      inherited={data.inherited}
      initialMedia={data.media}
    >
      <FormProvider {...form}>
        <form
          method="post"
          onSubmit={(event) => void save(event)}
          noValidate
          className="flex flex-col gap-6"
          data-hydrated={hydrated || undefined}
        >
          <div className="sticky top-14 z-[5] -mx-4 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="min-w-48 flex-1 basis-48">
              <h1 className="truncate text-xl font-semibold">{data.document.label}</h1>
              {subtitle || data.document.path ? (
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {subtitle ?? data.document.path}
                </p>
              ) : null}
            </div>
            <SimpleSelect
              value={data.locale}
              onChange={switchLocale}
              options={locales.map((locale) => ({
                value: locale.code,
                label: `${locale.label} (${locale.code})${locale.draft ? ' · Draft' : ''}`,
              }))}
              ariaLabel="Language"
              className="w-44"
            />
            {data.publicUrl ? (
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<a href={data.publicUrl} target="_blank" rel="noopener noreferrer" />}
              >
                <ExternalLinkIcon />
                View page
              </Button>
            ) : null}
            {actions}
            {data.hasCodeDefaults ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="More actions"
                    />
                  }
                >
                  <EllipsisIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onClick={() => setResetOpen(true)}>
                    <RotateCcwIcon />
                    Reset to code defaults…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <RevisionsSheet
              data={data}
              versions={versions}
              dirty={isDirty}
              onRestored={onRestored}
            />
            {isDirty ? (
              <Badge
                variant="outline"
                className="border-amber-500/50 text-amber-700 dark:text-amber-300"
                role="status"
              >
                Unsaved changes
              </Badge>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isDirty || isSubmitting}
              onClick={() => form.reset()}
            >
              <Undo2Icon />
              Discard
            </Button>
            <Button type="submit" size="sm" disabled={!isDirty || isSubmitting}>
              {isSubmitting ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
              Save
            </Button>
          </div>

          {conflict ? (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>This was changed by someone else</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                <span>{conflict}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Reload latest version
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {panel}

          {data.document.hasSeo ? (
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(String(value))}
              className="max-w-3xl"
            >
              <TabsList>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="seo">Google &amp; sharing</TabsTrigger>
              </TabsList>
              <TabsContent value="content" keepMounted className="pt-4">
                <SectionFields
                  sections={data.document.sections}
                  shared={data.shared}
                  currentPageId={
                    data.document.target.kind === DocumentKind.Page
                      ? data.document.target.id
                      : undefined
                  }
                />
              </TabsContent>
              <TabsContent value="seo" keepMounted className="pt-4">
                <SeoPanel publicUrl={data.publicUrl ?? ''} defaults={data.document.seoDefaults} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="max-w-3xl">
              <SectionFields
                sections={data.document.sections}
                shared={data.shared}
                currentPageId={
                  data.document.target.kind === DocumentKind.Page
                    ? data.document.target.id
                    : undefined
                }
              />
            </div>
          )}
        </form>
      </FormProvider>
      {data.hasCodeDefaults ? (
        <CodeDefaultsDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          data={data}
          versions={versions}
          sharedVersions={sharedVersions}
          dirty={isDirty}
          localeLabel={localeLabel}
          onReset={onCodeDefaults}
          onConflict={setConflict}
        />
      ) : null}
      {/* Outside the form: interface texts save on their own. */}
      <div className="mt-6">
        <InterfaceTextsPanel groups={data.uiTexts} locale={data.locale} localeLabel={localeLabel} />
      </div>
    </EditorProvider>
  );
}
